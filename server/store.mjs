import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { ApiError, batchFingerprint, newSession, randomColor, tokenHash } from './protocol.mjs';
import { chargeBudget } from './costPolicy.mjs';
import { beginLimitedTransaction } from './databaseLimits.mjs';
import { consolidateInactive } from './retention.mjs';
import { normalizeCountry } from './countryCodes.mjs';
import { countrySnapshot } from './countrySnapshot.mjs';
import {regionCenter} from './regionGrid.mjs';

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
    query_timeout: 6_000,
    allowExitOnIdle: true
  });
  return pool;
}

export async function consumeApiBudget(category = 'requests') {
  try {
    if (!await chargeBudget({query}, category)) {
      throw new ApiError(429,'operation_budget_exhausted','Limite temporário da plataforma atingido. Tente mais tarde.');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503,'operation_budget_unavailable','Controle de capacidade indisponível. Tente mais tarde.');
  }
}

async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await beginLimitedTransaction(client);
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

function query(text, values) {
  return transaction(client => client.query(text, values));
}

export async function findVisitor(token, country='ZZ') {
  if (!token) return null;
  const { rows } = await query(
    `WITH renewed AS (
      UPDATE world_pulse.visitors AS current SET last_seen_at=statement_timestamp(),
        country_code=CASE WHEN country_consent THEN $2 ELSE 'ZZ' END,
        expires_at=GREATEST(current.expires_at,statement_timestamp()+interval '30 days',
          COALESCE((SELECT max(vt.expires_at)+interval '1 day' FROM world_pulse.visitor_tags vt WHERE vt.visitor_id=current.id),statement_timestamp()))
      WHERE session_hash=$1 AND current.expires_at>statement_timestamp() RETURNING id,active_tag_id,expires_at,country_consent,country_code,country_consent_at,region_cell
    ) SELECT v.id, v.active_tag_id,v.expires_at,v.country_consent,v.country_code,v.country_consent_at,v.region_cell,
      t.normalized AS active_tag_name, t.color AS active_tag_color
    FROM renewed v
    LEFT JOIN world_pulse.tags t ON t.id = v.active_tag_id
    `,
    [tokenHash(token),normalizeCountry(country)]
  );
  return rows[0] ?? null;
}

export async function setRegionCell(visitorId,cell,country='ZZ'){
  if(cell!==null)regionCenter(cell);
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(1867401)');
    await client.query('SELECT pg_advisory_xact_lock(1867403)');
    const changed=await client.query(`UPDATE world_pulse.visitors SET region_cell=$2,region_shared_at=statement_timestamp(),
      country_consent=$3,country_code=$4,country_consent_at=statement_timestamp() WHERE id=$1`,[visitorId,cell,cell!==null,cell!==null?normalizeCountry(country):'ZZ']);
    if(!changed.rowCount)throw new ApiError(401,'session_expired','Sessão expirada.');
    await client.query('DELETE FROM world_pulse.region_snapshot_cache');
    await client.query('DELETE FROM world_pulse.country_snapshot_cache');
  });
}

export async function getRegionSnapshot(){
  return transaction(async client=>{
    const {rows:[clock]}=await client.query('SELECT floor(extract(epoch FROM statement_timestamp())/5)*5000 AS ms');
    const asOfMs=Number(clock.ms);
    const cached=await client.query('SELECT payload FROM world_pulse.region_snapshot_cache WHERE key=true AND window_start=to_timestamp($1/1000.0)',[asOfMs]);
    if(cached.rows.length)return cached.rows[0].payload;
    const {rows:[lock]}=await client.query('SELECT pg_try_advisory_xact_lock(1867403) AS acquired');
    if(!lock.acquired)throw new ApiError(503,'geography_refreshing','Mapa atualizando.');
    const {rows}=await client.query(`SELECT v.region_cell AS cell,t.id AS "tagId",'#'||t.normalized AS name,t.color,count(*)::text AS participants
      FROM world_pulse.visitor_tags vt JOIN world_pulse.visitors v ON v.id=vt.visitor_id JOIN world_pulse.tags t ON t.id=vt.tag_id
      WHERE vt.expires_at>statement_timestamp() AND v.region_cell IS NOT NULL
      GROUP BY v.region_cell,t.id,t.normalized,t.color ORDER BY v.region_cell,t.id LIMIT 2001`);
    if(rows.length>2000)throw new ApiError(503,'geography_capacity','Mapa regional temporariamente indisponível.');
    const payload={type:'region_snapshot',asOfMs,validUntilMs:asOfMs+5000,cells:rows};
    await client.query(`INSERT INTO world_pulse.region_snapshot_cache(key,window_start,payload) VALUES(true,to_timestamp($1/1000.0),$2::jsonb)
      ON CONFLICT(key) DO UPDATE SET window_start=EXCLUDED.window_start,payload=EXCLUDED.payload`,[asOfMs,JSON.stringify(payload)]);
    return payload;
  });
}

export async function createVisitor() {
  await consumeApiBudget('sessions');
  const session = newSession();
  await query(
    "INSERT INTO world_pulse.visitors (id,session_hash,expires_at) VALUES($1,$2,now()+interval '30 days')",
    [session.visitorId, session.hash]
  );
  return session;
}

export async function requireVisitor(token,country='ZZ') {
  const visitor = await findVisitor(token,country);
  if (!visitor) throw new ApiError(401, 'session_expired', 'Sessão expirada. Recarregue a página.');
  return visitor;
}

export async function setCountryConsent(visitorId,allowed,country='ZZ') {
  if(typeof allowed!=='boolean')throw new ApiError(400,'invalid_geo_consent','Escolha de país inválida.');
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(1867401)');
    const {rows:[old]}=await client.query('SELECT country_consent FROM world_pulse.visitors WHERE id=$1 FOR UPDATE',[visitorId]);
    if(!old)throw new ApiError(401,'session_expired','Sessão expirada.');
    await client.query('UPDATE world_pulse.visitors SET country_consent=$2,country_code=$3,country_consent_at=statement_timestamp() WHERE id=$1',
      [visitorId,allowed,allowed?normalizeCountry(country):'ZZ']);
    // An explicit withdrawal stops publication without waiting for cache expiry.
    if(!allowed&&old.country_consent)await client.query('DELETE FROM world_pulse.country_snapshot_cache');
  });
}

export async function getCountrySnapshot() {
  return transaction(async client=>{
    const {rows:[clock]}=await client.query("SELECT floor(extract(epoch FROM statement_timestamp())/5)*5000 AS ms");
    const asOfMs=Number(clock.ms);
    const cached=await client.query('SELECT payload FROM world_pulse.country_snapshot_cache WHERE key=true AND window_start=to_timestamp($1/1000.0)',[asOfMs]);
    if(cached.rows.length)return cached.rows[0].payload;
    const {rows:[lock]}=await client.query('SELECT pg_try_advisory_xact_lock(1867401) AS acquired');
    if(!lock.acquired)throw new ApiError(503,'geography_refreshing','Origem geográfica sendo atualizada.');
    const {rows}=await client.query(`SELECT t.id AS tag_id,t.normalized,t.color,
      CASE WHEN v.country_consent THEN v.country_code ELSE 'ZZ' END AS country_code,
      count(*)::text AS participants
      FROM world_pulse.visitor_tags vt JOIN world_pulse.visitors v ON v.id=vt.visitor_id
      JOIN world_pulse.tags t ON t.id=vt.tag_id
      WHERE vt.expires_at>statement_timestamp()
      GROUP BY t.id,t.normalized,t.color,CASE WHEN v.country_consent THEN v.country_code ELSE 'ZZ' END
      ORDER BY t.id,country_code LIMIT 5001`);
    if(rows.length>5000)throw new ApiError(503,'geography_capacity','Origem temporariamente indisponível.');
    const payload=countrySnapshot(rows,asOfMs);
    await client.query(`INSERT INTO world_pulse.country_snapshot_cache(key,window_start,payload)
      VALUES(true,to_timestamp($1/1000.0),$2::jsonb) ON CONFLICT(key) DO UPDATE SET window_start=EXCLUDED.window_start,payload=EXCLUDED.payload`,[asOfMs,JSON.stringify(payload)]);
    return payload;
  });
}

export async function createOrGetTag(rawName) {
  const { normalizeHashtag } = await import('./protocol.mjs');
  const normalized = normalizeHashtag(rawName);
  const existing = await query('SELECT id,normalized,color FROM world_pulse.tags WHERE normalized=$1',[normalized]);
  if (existing.rows.length) {
    const tag=existing.rows[0];
    return {id:tag.id,name:'#'+tag.normalized,color:tag.color};
  }
  await consumeApiBudget('tags');
  const id = randomUUID();
  const color = randomColor();
  const inserted = await query(
    'INSERT INTO world_pulse.tags (id, normalized, color) VALUES($1,$2,$3) ON CONFLICT(normalized) DO NOTHING RETURNING id,normalized,color',
    [id, normalized, color]
  );
  const record = inserted.rows[0] ?? (await query(
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
      if (Number(recent.rows[0].clicks) + clicks > 1200) {
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
  const rows = await query(`
    SELECT vt.tag_id, vt.seconds::text AS seconds, vt.expires_at, statement_timestamp() AS server_now,t.normalized,t.color
    FROM world_pulse.visitor_tags vt JOIN world_pulse.tags t ON t.id=vt.tag_id
    JOIN world_pulse.visitors v ON v.id=vt.visitor_id
    WHERE vt.visitor_id=$1 AND vt.seconds > 0
    ORDER BY (vt.tag_id=v.active_tag_id) DESC NULLS LAST,
      (vt.expires_at>statement_timestamp()) DESC,vt.expires_at DESC,vt.tag_id ASC LIMIT 201
  `, [visitorId]);
  return rows.rows.map(serializeBalance);
}

export async function getRanking() {
  const rows = await query(`
    SELECT t.id, t.normalized, t.color,
           (COUNT(vt.visitor_id)+COALESCE(MAX(h.participants),0))::text AS historical_participants,
           (COALESCE(SUM(vt.seconds),0)+COALESCE(MAX(h.credited_seconds),0))::text AS credited_seconds
    FROM world_pulse.tags t
    LEFT JOIN world_pulse.visitor_tags vt ON vt.tag_id=t.id
    LEFT JOIN world_pulse.tag_history_totals h ON h.tag_id=t.id
    GROUP BY t.id,t.normalized,t.color
    HAVING COUNT(vt.visitor_id)+COALESCE(MAX(h.participants),0)>0
    ORDER BY COUNT(vt.visitor_id)+COALESCE(MAX(h.participants),0) DESC, t.normalized ASC, t.id ASC
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
 * /api/ranking uses this current metric; /api/history is a separate historical
 * view. Both remain gated. Country/coordinates are unavailable in this model.
 */
export async function getActiveBalanceSnapshot() {
  const { rows } = await query(`
    WITH snapshot AS (
      SELECT statement_timestamp() AS observed_at
    ), counts AS (
      SELECT t.id, t.normalized, t.color,
        COUNT(vt.visitor_id) FILTER (
          WHERE vt.expires_at > snapshot.observed_at
        ) AS active_participants,
        COUNT(vt.visitor_id)+COALESCE(MAX(h.participants),0) AS historical_participants,
        COALESCE(SUM(vt.seconds), 0)+COALESCE(MAX(h.credited_seconds),0) AS credited_seconds
      FROM world_pulse.tags AS t
      CROSS JOIN snapshot
      LEFT JOIN world_pulse.visitor_tags AS vt ON vt.tag_id = t.id
      LEFT JOIN world_pulse.tag_history_totals h ON h.tag_id=t.id
      GROUP BY t.id, t.normalized, t.color
    )
    SELECT id, normalized, color,
      active_participants::text AS active_participants,
      historical_participants::text AS historical_participants,
      credited_seconds::text AS credited_seconds,
      (SELECT observed_at FROM snapshot) AS as_of
    FROM counts
    ORDER BY active_participants DESC, normalized ASC, id ASC
    LIMIT 10
  `);
  const asOfMs = rows[0]?.as_of?.getTime() ?? Date.now();
  return {
    type: 'active',
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

export function consolidateInactiveVisitors(options) {
  return consolidateInactive(getPool(),options);
}

/**
 * Retention maintenance preview (#5), NOT scheduled or exposed over HTTP.
 *
 * Expired visitors can never authenticate their old batch IDs again, so
 * their deduplication rows can be safely removed after 24h extra grace.
 * This function deliberately DOES NOT delete visitors, visitor_tags,
 * credited seconds, or active sessions. Those require an approved GDPR policy.
 */
export async function pruneExpiredSessionBatches({ limit = 500 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) {
    throw new RangeError('Batch maintenance limit must be 1..5000');
  }
  const result = await query(`
    WITH expired_batches AS (
      SELECT b.visitor_id, b.batch_id
      FROM world_pulse.tap_batches AS b
      JOIN world_pulse.visitors AS v ON v.id = b.visitor_id
      WHERE v.expires_at < statement_timestamp() - interval '24 hours'
      ORDER BY b.created_at ASC, b.visitor_id ASC, b.batch_id ASC
      LIMIT $1
      FOR UPDATE OF b SKIP LOCKED
    )
    DELETE FROM world_pulse.tap_batches AS b
    USING expired_batches AS e
    WHERE b.visitor_id = e.visitor_id AND b.batch_id = e.batch_id
    RETURNING b.batch_id
  `, [limit]);
  return { deletedBatches: result.rowCount, limit };
}
