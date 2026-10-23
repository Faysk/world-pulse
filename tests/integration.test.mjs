import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import {
  useTestPool, createVisitor, findVisitor, createOrGetTag, selectTag,
  creditBatch, getCredits, getRanking
} from '../server/store.mjs';

test('PostgreSQL: anonymous participation and transaction invariants', {
  skip: !process.env.RUN_DB_INTEGRATION
}, async t => {
  process.env.NODE_ENV = 'test';
  const owner = new pg.Pool({
    connectionString: 'postgresql://postgres:local-only@localhost:5432/world_pulse_ci',
    ssl: false, max: 2
  });
  const app = new pg.Pool({
    connectionString: 'postgresql://world_pulse_app:local-only@localhost:5432/world_pulse_ci',
    ssl: false, max: 4
  });
  t.after(async () => { await app.end(); await owner.end(); });

  await owner.query("CREATE ROLE world_pulse_app LOGIN PASSWORD 'local-only'");
  await owner.query(await readFile(new URL('../infra/sql/0001-runtime-access.sql', import.meta.url), 'utf8'));
  await owner.query(await readFile(new URL('../infra/sql/0002-participation-core.sql', import.meta.url), 'utf8'));
  useTestPool(app);

  let sessionA, sessionB, gta6, lofi;
  await t.test('Session token stored as a hash, not plaintext', async () => {
    sessionA = await createVisitor();
    sessionB = await createVisitor();
    assert.notEqual(sessionA.hash, sessionA.token);
    assert.notEqual(sessionB.token, sessionA.token);
    assert.equal((await findVisitor(sessionA.token)).id, sessionA.visitorId);
    assert.equal((await findVisitor(sessionB.token)).id, sessionB.visitorId);
    assert.equal(await findVisitor('definitelynotasession'), null);
    const stored = await owner.query('SELECT session_hash FROM world_pulse.visitors WHERE id=$1', [sessionA.visitorId]);
    assert.equal(stored.rows[0].session_hash.trim(), sessionA.hash);
  });

  await t.test('Same hashtag ID and random color across browsers', async () => {
    const tags = await Promise.all([
      createOrGetTag('#GTA6'), createOrGetTag('gta6'), createOrGetTag('##gta6')
    ]);
    gta6 = tags[0];
    assert.equal(tags[1].id, gta6.id);
    assert.equal(tags[2].color, gta6.color);
    assert.match(gta6.color, /^#[0-9a-f]{6}$/);
    lofi = await createOrGetTag('LoFi');
    assert.notEqual(lofi.id, gta6.id);
  });

  await t.test('A click batch is credited exactly once even with concurrent requests', async () => {
    await selectTag(sessionA.visitorId, gta6.id);
    await selectTag(sessionB.visitorId, gta6.id);
    const batch = { tagId: gta6.id, batchId: randomUUID(), clicks: 3 };
    const [first, retry] = await Promise.all([
      creditBatch(sessionA.visitorId, batch), creditBatch(sessionA.visitorId, batch)
    ]);
    assert.equal(first.acceptedClicks + retry.acceptedClicks, 3);
    assert.equal([first.duplicate, retry.duplicate].filter(Boolean).length, 1);
    assert.equal(first.creditedSeconds, '3');
    assert.equal(retry.creditedSeconds, '3');
    await assert.rejects(creditBatch(sessionA.visitorId, { ...batch, clicks: 5 }), {
      code: 'batch_id_conflict', status: 409
    });
    // The same UUID on a DIFFERENT visitor is a separate, legitimate batch.
    const b = await creditBatch(sessionB.visitorId, { tagId: gta6.id, batchId: batch.batchId, clicks: 1 });
    assert.equal(b.creditedSeconds, '1');
  });

  await t.test('Delayed A batch is attributed to A after selecting B, never reactivates A', async () => {
    await selectTag(sessionA.visitorId, lofi.id);
    const old = await creditBatch(sessionA.visitorId, {
      tagId: gta6.id, batchId: randomUUID(), clicks: 2
    });
    assert.equal(old.creditedSeconds, '5');
    assert.equal((await findVisitor(sessionA.token)).active_tag_id, lofi.id);
    const credits = await getCredits(sessionA.visitorId);
    assert.equal(credits.find(x => x.tagId === gta6.id).creditedSeconds, '5');
    assert.equal(credits.find(x => x.tagId === lofi.id), undefined);
  });

  await t.test('Tag never selected cannot receive forged credits', async () => {
    await assert.rejects(creditBatch(sessionB.visitorId, {
      tagId: lofi.id, batchId: randomUUID(), clicks: 1
    }), { code: 'tag_not_selected', status: 409 });
  });

  await t.test('Ranking uses historical participants and credited seconds only', async () => {
    const ranking = await getRanking();
    const top = ranking.find(x => x.id === gta6.id);
    assert.equal(top.historicalParticipants, '2');
    assert.equal(top.creditedSeconds, '6');
    assert.equal('lat' in top, false);
    assert.equal('visitorId' in top, false);
    assert.equal('active' in top, false);
  });

  await t.test('Limits prevent giant claimed batches and repeated fast submissions', async () => {
    const newcomer = await createVisitor();
    await selectTag(newcomer.visitorId, gta6.id);
    for (let i=0; i<4; i++) {
      const x = await creditBatch(newcomer.visitorId, {tagId:gta6.id,batchId:randomUUID(),clicks:30});
      assert.equal(x.acceptedClicks,30);
    }
    await assert.rejects(creditBatch(newcomer.visitorId, {
      tagId:gta6.id,batchId:randomUUID(),clicks:1
    }), { code:'rate_limited', status:429 });
  });

  await t.test('Expired browser sessions cannot be reused', async () => {
    await owner.query("UPDATE world_pulse.visitors SET expires_at=now()-interval '1 second' WHERE id=$1", [sessionB.visitorId]);
    assert.equal(await findVisitor(sessionB.token), null);
  });

  await t.test('Runtime role cannot create tables in isolated schema', async () => {
    await assert.rejects(app.query('CREATE TABLE world_pulse.unauthorized (id int)'), /permission denied/);
  });
});
