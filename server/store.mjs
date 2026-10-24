import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { ApiError, batchFingerprint, newSession, randomColor, tokenHash } from './protocol.mjs';

let pool;

// Test-only injection allows the CI's disposable PostgreSQL to run without
// weakening the production requirement for verify-full TLS.
export function useTestPool(database) {
  if (process.env.NODE_ENV !== 'test') throw new Error('test_pool_forbidden');
  pool = database;
}

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new ApiError(503, 'database_not_ready', 'Participação real ainda não está disponível.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new ApiError(503, 'database_not_ready', 'Configuração indisponível.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.searchParams.get('sslmode') !== 'verify-full') {
    throw new ApiError(503, 'database_not_ready', 'Ligação segura indisponível.');
  }
  pool = new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true
  });
  return pool;
}

async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findVisitor(token) {
  if (!token) return null;
  const { rows } = await getPool().query(
    `SELECT v.id, v.active_tag_id,
      t.normalized AS active_tag_name, t.color AS active_tag_color
    FROM world_pulse.visitors v
    LEFT JOIN world_pulse.tags t ON t.id = v.active_tag_id
    WHERE v.session_hash = $1 AND v.expires_at > now()`,
    [tokenHash(token)]
  );
  return rows[0] ?? null;
}

export async function createVisitor() {
  const session = newSession();
  await getPool().query(
    "INSERT INTO world_pulse.visitors (id,session_hash,expires_at) VALUES($1,$2,now()+interval '30 days')",
    [session.visitorId, session.hash]
  );
  return session;
}

export async function requireVisitor(token) {
  const visitor = await findVisitor(token);
  if (!visitor) throw new ApiError(401, 'session_expired', 'Sessão expirada. Recarregue a página.');
  return visitor;
}

export async function createOrGetTag(rawName) {
  const { normalizeHashtag } = await import('./protocol.mjs');
  const normalized = normalizeHashtag(rawName);
  const id = randomUUID();
  const color = randomColor();
  const inserted = await getPool().query(
    'INSERT INTO world_pulse.tags (id, normalized, color) VALUES($1,$2,$3) ON CONFLICT(normalized) DO NOTHING RETURNING id,normalized,color',
    [id, normalized, color]
  );
  const record = inserted.rows[0] ?? (await getPool().query(
    'SELECT id,normalized,color FROM world_pulse.tags WHERE normalized=$1', [normalized]
  )).rows[0];
  if (!record) throw new ApiError(503,'tag_unavailable','Hashtag indisponível.');
  return { id: record.id, name: '#' + record.normalized, color: record.color };
}

export async function selectTag(visitorId, tagId) {
  return transaction(async client => {
    const visitor = await client.query('SELECT id FROM world_pulse.visitors WHERE id=$1 FOR UPDATE', [visitorId]);
    if (!visitor.rows.length) throw new ApiError(401,'session_expired','Sessão expirada.');
    if (tagId) {
      const tag = await client.query('SELECT id FROM world_pulse.tags WHERE id=$1', [tagId]);
      if (!tag.rows.length) throw new ApiError(404,'tag_not_found','Hashtag inexistente.');
      await client.query(`
        INSERT INTO world_pulse.visitor_tags (visitor_id, tag_id, selected_at)
        VALUES ($1, $2, now())
        ON CONFLICT(visitor_id, tag_id) DO UPDATE SET selected_at=now()
      `, [visitorId, tagId]);
    }
    await client.query(
      'UPDATE world_pulse.visitors SET active_tag_id=$2,updated_at=now() WHERE id=$1',
      [visitorId, tagId]
    );
    return { activeTagId: tagId };
  });
}

export async function creditBatch(visitorId, { tagId, batchId, clicks }) {
  const fingerprint = batchFingerprint(tagId, clicks);
  return transaction(async client => {
    // Serializes batches for this visitor, including concurrent retries.
    const visitor = await client.query(
      'SELECT id, active_tag_id FROM world_pulse.visitors WHERE id=$1 FOR UPDATE',
      [visitorId]
    );
    if (!visitor.rows.length) throw new ApiError(401,'session_expired','Sessão expirada.');

    const existing = await client.query(
      'SELECT tag_id,fingerprint FROM world_pulse.tap_batches WHERE visitor_id=$1 AND batch_id=$2',
      [visitorId, batchId]
    );
    let duplicate = Boolean(existing.rows.length);
    if (duplicate && (existing.rows[0].fingerprint !== fingerprint || existing.rows[0].tag_id !== tagId)) {
      throw new ApiError(409, 'batch_id_conflict', 'O mesmo lote não pode ter valores diferentes.');
    }

    const association = await client.query(
      'SELECT seconds FROM world_pulse.visitor_tags WHERE visitor_id=$1 AND tag_id=$2',
      [visitorId, tagId]
    );
    if (!association.rows.length) throw new ApiError(409,'tag_not_selected','Selecione a hashtag antes de contribuir.');

    if (!duplicate) {
      const recent = await client.query(`
        SELECT COALESCE(SUM(clicks), 0)::int AS clicks
        FROM world_pulse.tap_batches
        WHERE visitor_id=$1 AND created_at > now() - interval '1 minute'
      `, [visitorId]);
      if (Number(recent.rows[0].clicks) + clicks > 120) {
        throw new ApiError(429, 'rate_limited', 'Limite temporário de toques atingido.');
      }
      await client.query(`
        INSERT INTO world_pulse.tap_batches(visitor_id,batch_id,tag_id,clicks,fingerprint)
        VALUES ($1,$2,$3,$4,$5)
      `, [visitorId, batchId, tagId, clicks, fingerprint]);
      await client.query(`
        UPDATE world_pulse.visitor_tags
        SET seconds=seconds+$3,
            expires_at=GREATEST(expires_at,statement_timestamp()) + $3 * interval '1 second',
            first_tap_at=COALESCE(first_tap_at,now()),
            last_tap_at=now()
        WHERE visitor_id=$1 AND tag_id=$2
      `, [visitorId, tagId, clicks]);
    }

    // Newly accepted taps extend this tag's balance, including after selection
    // changes. A duplicate never updates history OR expiry, and never changes selection.
    const total = await client.query(
      `SELECT vt.tag_id,vt.seconds::text AS seconds,vt.expires_at,statement_timestamp() AS server_now,t.normalized,t.color
       FROM world_pulse.visitor_tags vt JOIN world_pulse.tags t ON t.id=vt.tag_id
       WHERE vt.visitor_id=$1 AND vt.tag_id=$2`,
      [visitorId, tagId]
    );
    return {
      batchId, tagId, acceptedClicks: duplicate ? 0 : clicks,
      duplicate, ...serializeBalance(total.rows[0])
    };
  });
}

function serializeBalance(row) {
  const expiresAtMs = row.expires_at.getTime();
  const serverNowMs = row.server_now.getTime();
  return { tagId: row.tag_id, creditedSeconds: row.seconds,
    expiresAtMs, serverNowMs, remainingMs: Math.max(0, expiresAtMs - serverNowMs),
    name: '#' + row.normalized, color: row.color };
}

export async function getCredits(visitorId) {
  const rows = await getPool().query(`
    SELECT vt.tag_id, vt.seconds::text AS seconds, vt.expires_at, statement_timestamp() AS server_now,t.normalized,t.color
    FROM world_pulse.visitor_tags vt JOIN world_pulse.tags t ON t.id=vt.tag_id
    WHERE vt.visitor_id=$1 AND vt.seconds > 0 ORDER BY vt.tag_id LIMIT 200
  `, [visitorId]);
  return rows.rows.map(serializeBalance);
}

export async function getRanking() {
  const rows = await getPool().query(`
    SELECT t.id, t.normalized, t.color,
           COUNT(vt.visitor_id)::text AS historical_participants,
           COALESCE(SUM(vt.seconds),0)::text AS credited_seconds
    FROM world_pulse.tags t
    JOIN world_pulse.visitor_tags vt ON vt.tag_id=t.id AND vt.seconds>0
    GROUP BY t.id,t.normalized,t.color
    ORDER BY COUNT(vt.visitor_id) DESC, COALESCE(SUM(vt.seconds),0) DESC, t.normalized ASC
    LIMIT 10
  `);
  return rows.rows.map(row => ({
    id: row.id, name: '#' + row.normalized, color: row.color,
    historicalParticipants: row.historical_participants,
    creditedSeconds: row.credited_seconds
  }));
}

/**
 * Active-balance snapshot (#8) — distinct pseudonymous sessions, not humans.
 *
 * Presence is defined ONLY by a balance with expires_at > the SAME server
 * statement_timestamp() for the entire query. Historical contributions never
 * count as current presence. A visitor may be active in multiple hashtags.
 *
 * This is an experimental NON-GEO preview, separate from the historical
 * /api/ranking route until the product metric and regional privacy are signed off.
 */
export async function getActiveBalanceSnapshot() {
  const { rows } = await getPool().query(`
    WITH snapshot AS (
      SELECT statement_timestamp() AS observed_at
    ), counts AS (
      SELECT t.id, t.normalized, t.color,
        COUNT(vt.visitor_id) FILTER (
          WHERE vt.expires_at > snapshot.observed_at
        ) AS active_participants,
        COUNT(vt.visitor_id) FILTER (
          WHERE vt.seconds > 0
        ) AS historical_participants,
        COALESCE(SUM(vt.seconds), 0) AS credited_seconds
      FROM world_pulse.tags AS t
      CROSS JOIN snapshot
      LEFT JOIN world_pulse.visitor_tags AS vt ON vt.tag_id = t.id
      GROUP BY t.id, t.normalized, t.color
    )
    SELECT id, normalized, color,
      active_participants::text AS active_participants,
      historical_participants::text AS historical_participants,
      credited_seconds::text AS credited_seconds,
      (SELECT observed_at FROM snapshot) AS as_of
    FROM counts
    ORDER BY active_participants DESC, historical_participants DESC,
      normalized ASC, id ASC
    LIMIT 10
  `);
  const asOfMs = rows[0]?.as_of?.getTime() ?? Date.now();
  return {
    type: 'active_balance_preview',
    asOfMs,
    metric: 'distinct_anonymous_sessions_with_positive_balance',
    geography: 'unavailable',
    ranking: rows.map(row => ({
      id: row.id,
      name: '#' + row.normalized,
      color: row.color,
      activeParticipants: row.active_participants,
      historicalParticipants: row.historical_participants,
      creditedSeconds: row.credited_seconds
    }))
  };
}
