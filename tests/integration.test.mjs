import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import {
  useTestPool, createVisitor, findVisitor, createOrGetTag, selectTag,
  creditBatch, getCredits, getRanking, pruneExpiredSessionBatches, getActiveBalanceSnapshot
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
  const legacyVisitor = randomUUID(), legacyTag = randomUUID();
  await owner.query("INSERT INTO world_pulse.tags(id,normalized,color) VALUES($1,'legacy_migration','#123456')", [legacyTag]);
  await owner.query("INSERT INTO world_pulse.visitors(id,session_hash,expires_at) VALUES($1,$2,now()+interval '1 day')", [legacyVisitor, '0'.repeat(64)]);
  await owner.query('INSERT INTO world_pulse.visitor_tags(visitor_id,tag_id,seconds) VALUES($1,$2,42)', [legacyVisitor,legacyTag]);
  await owner.query(await readFile(new URL('../infra/sql/0003-time-balances.sql', import.meta.url), 'utf8'));
  useTestPool(app);
  await owner.query(await readFile(new URL('../infra/sql/0004-operation-budgets.sql', import.meta.url), 'utf8'));
  await owner.query(await readFile(new URL('../infra/sql/0005-retention-rollups.sql', import.meta.url), 'utf8'));
  await owner.query(await readFile(new URL('../infra/sql/0006-country-geography.sql', import.meta.url), 'utf8'));
  await owner.query(await readFile(new URL('../infra/sql/0007-regional-points.sql', import.meta.url), 'utf8'));
  await owner.query("UPDATE world_pulse.visitors SET region_cell='r1:257:266' WHERE id=$1",[legacyVisitor]);
  await owner.query(await readFile(new URL('../infra/sql/0008-one-km-regions.sql', import.meta.url), 'utf8'));
  await owner.query(await readFile(new URL('../infra/sql/0008-one-km-regions.sql', import.meta.url), 'utf8'));
  assert.equal((await owner.query('SELECT region_cell FROM world_pulse.visitors WHERE id=$1',[legacyVisitor])).rows[0].region_cell,'r1:257:266');
  await assert.rejects(owner.query("UPDATE world_pulse.visitors SET region_cell='r3:1:1' WHERE id=$1",[legacyVisitor]),{code:'23514'});

  await t.test('Migration preserves history without inventing live balances and is repeatable', async () => {
    const [legacy] = await getCredits(legacyVisitor);
    assert.equal(legacy.creditedSeconds, '42');
    assert.equal(legacy.remainingMs, 0);
    await owner.query(await readFile(new URL('../infra/sql/0003-time-balances.sql', import.meta.url), 'utf8'));
    assert.equal((await getCredits(legacyVisitor))[0].expiresAtMs, legacy.expiresAtMs);
  });

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

  await t.test('Delayed A batch extends A balance after selecting B, never changes current selection', async () => {
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

  await t.test('Eight-hour balance top-up, duplicates, offline return and several live tags', async () => {
    const visitor = await createVisitor();
    await selectTag(visitor.visitorId, gta6.id);
    // Set a known unexpired balance independently of historical tap totals.
    const expiry = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await owner.query('UPDATE world_pulse.visitor_tags SET seconds=10,expires_at=$3 WHERE visitor_id=$1 AND tag_id=$2',
      [visitor.visitorId, gta6.id, expiry]);
    const batch = { tagId:gta6.id, batchId:randomUUID(), clicks:3 };
    const [one, duplicate] = await Promise.all([creditBatch(visitor.visitorId,batch),creditBatch(visitor.visitorId,batch)]);
    assert.equal(one.expiresAtMs, expiry.getTime()+3000);
    assert.equal(duplicate.expiresAtMs, one.expiresAtMs);
    assert.equal(one.creditedSeconds, '13');
    assert.equal(duplicate.creditedSeconds, '13');

    await selectTag(visitor.visitorId, lofi.id);
    const b = await creditBatch(visitor.visitorId, { tagId:lofi.id,batchId:randomUUID(),clicks:30 });
    const a = (await getCredits(visitor.visitorId)).find(x=>x.tagId===gta6.id);
    assert.equal(a.expiresAtMs, one.expiresAtMs, 'selecting/crediting B never pauses or resets A');
    assert.ok(a.remainingMs>0 && b.remainingMs>0);
    assert.equal((await findVisitor(visitor.token)).active_tag_id, lofi.id);

    // Model wall-clock passage without sleeping or writing periodic countdowns.
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=statement_timestamp()-interval '1 hour' WHERE visitor_id=$1 AND tag_id=$2", [visitor.visitorId,gta6.id]);
    const returningVisitor = await findVisitor(visitor.token);
    const expired = (await getCredits(returningVisitor.id)).find(x=>x.tagId===gta6.id);
    assert.equal(expired.remainingMs, 0);
    assert.equal(expired.creditedSeconds, '13');
    const oldRetry = await creditBatch(visitor.visitorId,batch);
    assert.equal(oldRetry.expiresAtMs, expired.expiresAtMs, 'retry cannot revive expired credit');
    assert.equal(oldRetry.remainingMs, 0);

    await selectTag(visitor.visitorId, gta6.id);
    const renewed = await creditBatch(visitor.visitorId, { tagId:gta6.id,batchId:randomUUID(),clicks:2 });
    assert.equal(renewed.creditedSeconds, '15');
    assert.ok(renewed.expiresAtMs>=renewed.serverNowMs);
    assert.ok(renewed.remainingMs<=2000, 'expired balance starts from server clock, never adds old history');
    assert.equal((await getCredits(visitor.visitorId)).find(x=>x.tagId===lofi.id).expiresAtMs, b.expiresAtMs);
  });

  await t.test('Limits prevent giant claimed batches and repeated fast submissions', async () => {
    const newcomer = await createVisitor();
    await selectTag(newcomer.visitorId, gta6.id);
    for (let i=0; i<40; i++) {
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


  await t.test('Active balance preview excludes expired accounts without erasing history', async () => {
    const title = await createOrGetTag('#activebalanceqa');
    const other = await createOrGetTag('#secondactiveqa');
    const a = await createVisitor();
    const b = await createVisitor();

    await selectTag(a.visitorId,title.id);
    await selectTag(b.visitorId,title.id);
    const selectedOnly = await getActiveBalanceSnapshot();
    assert.equal(selectedOnly.ranking.find(x => x.id === title.id).activeParticipants, '0',
      'selection registers history but creates no positive time balance');
    assert.equal(selectedOnly.ranking.find(x => x.id === title.id).historicalParticipants, '2');

    const batchA={tagId:title.id,batchId:randomUUID(),clicks:1};
    const batchB={tagId:title.id,batchId:randomUUID(),clicks:30};
    await creditBatch(a.visitorId,batchA);
    await creditBatch(b.visitorId,batchB);
    let snapshot=await getActiveBalanceSnapshot();
    let tag=snapshot.ranking.find(x => x.id === title.id);
    assert.equal(tag.activeParticipants,'2','30 taps are still one participant');
    assert.equal(tag.historicalParticipants,'2');
    assert.equal(tag.creditedSeconds,'31');
    assert.equal(snapshot.type,'active');
    assert.equal(snapshot.geography,'unavailable');
    assert.ok(snapshot.asOfMs > 0);
    assert.ok(!JSON.stringify(snapshot).includes(a.visitorId));
    assert.ok(!JSON.stringify(snapshot).includes(b.visitorId));

    // Simulate passage of time from the database server, not a browser clock.
    await owner.query(`
      UPDATE world_pulse.visitor_tags
      SET expires_at = statement_timestamp() - interval '1 minute'
      WHERE visitor_id=$1 AND tag_id=$2
    `,[b.visitorId,title.id]);
    snapshot=await getActiveBalanceSnapshot();
    tag=snapshot.ranking.find(x => x.id === title.id);
    assert.equal(tag.activeParticipants,'1','expired balance must not count');
    assert.equal(tag.historicalParticipants,'2','history must survive expiry');
    assert.equal(tag.creditedSeconds,'31','expired balances retain historical taps');

    // Retry cannot resurrect an expired balance.
    await creditBatch(b.visitorId,batchB);
    snapshot=await getActiveBalanceSnapshot();
    assert.equal(snapshot.ranking.find(x => x.id === title.id).activeParticipants,'1');

    await selectTag(a.visitorId,other.id);
    await creditBatch(a.visitorId,{tagId:other.id,batchId:randomUUID(),clicks:2});
    snapshot=await getActiveBalanceSnapshot();
    assert.equal(snapshot.ranking.find(x => x.id === title.id).activeParticipants,'1',
      'a visitor may have positive balances in multiple hashtags');
    assert.equal(snapshot.ranking.find(x => x.id === other.id).activeParticipants,'1');
    assert.equal(snapshot.ranking.find(x => x.id === other.id).historicalParticipants,'1');
    assert.equal(snapshot.ranking.find(x => x.id === other.id).creditedSeconds,'2');

    // A tag with no taps is represented honestly with zero, not omitted.
    const empty = await createOrGetTag('#emptyactivityqa');
    snapshot=await getActiveBalanceSnapshot();
    const emptyRow=snapshot.ranking.find(x=>x.id===empty.id);
    assert.ok(emptyRow);
    assert.equal(emptyRow.activeParticipants,'0');
    assert.equal(emptyRow.historicalParticipants,'0');
    assert.equal(emptyRow.creditedSeconds,'0');
  });


  await t.test('Selection counts in history immediately; live ties never rank by seconds', async () => {
    const a=await createOrGetTag('#aaa_live_tie');
    const z=await createOrGetTag('#zzz_live_tie');
    const visitor=await createVisitor();
    await selectTag(visitor.visitorId,a.id);
    await selectTag(visitor.visitorId,a.id);
    let history=await getRanking();
    assert.equal(history.find(tag=>tag.id===a.id).historicalParticipants,'1');
    assert.equal(history.find(tag=>tag.id===a.id).creditedSeconds,'0');
    await selectTag(visitor.visitorId,z.id);
    await creditBatch(visitor.visitorId,{tagId:a.id,batchId:randomUUID(),clicks:1});
    await creditBatch(visitor.visitorId,{tagId:z.id,batchId:randomUUID(),clicks:30});
    const snapshot=await getActiveBalanceSnapshot();
    assert.equal(snapshot.ranking.find(tag=>tag.id===a.id).activeParticipants,'1');
    assert.equal(snapshot.ranking.find(tag=>tag.id===z.id).activeParticipants,'1');
    assert.ok(snapshot.ranking.findIndex(tag=>tag.id===a.id)<snapshot.ranking.findIndex(tag=>tag.id===z.id));
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=statement_timestamp()-interval '1 second' WHERE visitor_id=$1",[visitor.visitorId]);
    const expired=await getActiveBalanceSnapshot();
    assert.equal(expired.ranking.find(tag=>tag.id===a.id).activeParticipants,'0');
    assert.equal(expired.ranking.find(tag=>tag.id===a.id).historicalParticipants,'1');
  });

  await t.test('Maintenance prunes only old dedupe IDs, never active IDs or historical seconds',async()=>{
    const tag=await createOrGetTag('#cleanup_case');
    const expired=await createVisitor();
    const active=await createVisitor();
    await selectTag(expired.visitorId,tag.id);
    await selectTag(active.visitorId,tag.id);
    await creditBatch(expired.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:2});
    await creditBatch(expired.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:3});
    await creditBatch(active.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:1});
    await owner.query(`
      UPDATE world_pulse.visitors
      SET expires_at=statement_timestamp()-interval '26 hours'
      WHERE id=$1
    `,[expired.visitorId]);
    await assert.rejects(
      Promise.resolve().then(()=>pruneExpiredSessionBatches({limit:5001})),
      RangeError
    );
    const first=await pruneExpiredSessionBatches({limit:1});
    assert.deepEqual(first,{deletedBatches:1,limit:1});
    const second=await pruneExpiredSessionBatches({limit:1});
    assert.deepEqual(second,{deletedBatches:1,limit:1});
    const third=await pruneExpiredSessionBatches({limit:500});
    assert.equal(third.deletedBatches,0);
    const batches=await owner.query(`
      SELECT visitor_id,count(*)::int AS count
      FROM world_pulse.tap_batches WHERE visitor_id IN ($1,$2)
      GROUP BY visitor_id
    `,[expired.visitorId,active.visitorId]);
    assert.equal(batches.rows.find(x=>x.visitor_id===expired.visitorId),undefined);
    assert.equal(batches.rows.find(x=>x.visitor_id===active.visitorId).count,1);
    const credits=await owner.query(`
      SELECT visitor_id,seconds::int AS seconds FROM world_pulse.visitor_tags
      WHERE visitor_id IN ($1,$2)
    `,[expired.visitorId,active.visitorId]);
    assert.equal(credits.rows.find(x=>x.visitor_id===expired.visitorId).seconds,5);
    assert.equal(credits.rows.find(x=>x.visitor_id===active.visitorId).seconds,1);
    assert.equal(await findVisitor(expired.token),null);
    assert.ok(await findVisitor(active.token));
  });

  await t.test('Runtime role cannot create tables in isolated schema', async () => {
    await assert.rejects(app.query('CREATE TABLE world_pulse.unauthorized (id int)'), /permission denied/);
  });
  await t.test('Global budgets are atomic across independent pools, reset windows, and bound row count', async () => {
    const {chargeBudget}=await import('../server/costPolicy.mjs');
    await owner.query(`INSERT INTO world_pulse.operation_budgets(scope,window_start,used)
      VALUES('requests_minute',date_trunc('minute',statement_timestamp()),2997),
        ('requests_day',date_trunc('day',statement_timestamp()),1)
      ON CONFLICT(scope) DO UPDATE SET window_start=EXCLUDED.window_start,used=EXCLUDED.used`);
    const secondPool=new pg.Pool({connectionString:'postgresql://world_pulse_app:local-only@localhost:5432/world_pulse_ci',ssl:false,max:4});
    try {
      const results=await Promise.all(Array.from({length:20},(_,i)=>chargeBudget(i%2?app:secondPool,'requests')));
      assert.equal(results.filter(Boolean).length,3);
      const counter=await owner.query("SELECT used FROM world_pulse.operation_budgets WHERE scope='requests_minute'");
      assert.equal(counter.rows[0].used,3000);
      await owner.query("UPDATE world_pulse.operation_budgets SET window_start=window_start-interval '1 minute' WHERE scope='requests_minute'");
      assert.equal(await chargeBudget(secondPool,'requests'),true);
      assert.equal((await owner.query("SELECT used FROM world_pulse.operation_budgets WHERE scope='requests_minute'")).rows[0].used,1);
      assert.ok((await owner.query('SELECT count(*)::int AS n FROM world_pulse.operation_budgets')).rows[0].n<=5);
      await assert.rejects(()=>chargeBudget(app,'user_supplied_scope'),RangeError);
    } finally {await secondPool.end();}
  });

  await t.test('Statement timeout is enforced on the server inside the actual transaction', async () => {
    const {beginLimitedTransaction}=await import('../server/databaseLimits.mjs');
    const client=await app.connect();
    try {
      await beginLimitedTransaction(client);
      const settings=await client.query("SELECT current_setting('statement_timeout') AS statement,current_setting('lock_timeout') AS lock");
      assert.equal(settings.rows[0].statement,'5s');
      assert.equal(settings.rows[0].lock,'1s');
      await assert.rejects(()=>client.query('SELECT pg_sleep(7)'),error=>error.code==='57014');
    } finally {await client.query('ROLLBACK');client.release();}
  });

  await t.test('30-day retention preserves totals exactly, skips live/recent sessions, rolls back and retries safely', async () => {
    const {consolidateInactive}=await import('../server/retention.mjs');
    const tag=await createOrGetTag('#aaa_retention');
    const a=await createVisitor(), b=await createVisitor(), c=await createVisitor(), d=await createVisitor();
    for(const v of [a,b,c,d]) await selectTag(v.visitorId,tag.id);
    await creditBatch(a.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:30});
    await creditBatch(b.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:1});
    await owner.query("UPDATE world_pulse.visitors SET last_seen_at=now()-interval '60 days',expires_at=now()-interval '1 day' WHERE id=ANY($1::uuid[])",[[a.visitorId,b.visitorId,d.visitorId]]);
    await owner.query("UPDATE world_pulse.visitors SET last_seen_at=now()-interval '1 day' WHERE id=$1",[c.visitorId]);
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=now()-interval '1 day' WHERE visitor_id=$1",[a.visitorId]);
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=now()+interval '1 hour' WHERE visitor_id=$1",[b.visitorId]);
    await owner.query("UPDATE world_pulse.visitors SET last_seen_at=now()-interval '45 days' WHERE id=$1",[d.visitorId]);
    const history=async()=> (await getRanking()).find(row=>row.id===tag.id);
    assert.equal((await history()).historicalParticipants,'4');
    assert.equal((await history()).creditedSeconds,'31');
    assert.deepEqual(await consolidateInactive(app,{limit:1}),{consolidatedVisitors:1});
    assert.equal(await findVisitor(a.token),null);
    assert.deepEqual(await consolidateInactive(app,{limit:100}),{consolidatedVisitors:1});
    assert.deepEqual(await consolidateInactive(app),{consolidatedVisitors:0});
    const survivors=await owner.query('SELECT id FROM world_pulse.visitors WHERE id=ANY($1::uuid[])',[[b.visitorId,c.visitorId]]);
    assert.equal(survivors.rows.length,2);
    assert.equal((await history()).historicalParticipants,'4');
    assert.equal((await history()).creditedSeconds,'31');
    assert.equal((await getActiveBalanceSnapshot()).ranking.find(row=>row.id===tag.id).activeParticipants,'1');
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM world_pulse.tap_batches WHERE visitor_id=$1',[a.visitorId])).rows[0].n,0);

    const e=await createVisitor(); await selectTag(e.visitorId,tag.id);
    await creditBatch(e.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:5});
    await owner.query("UPDATE world_pulse.visitors SET last_seen_at=now()-interval '60 days',expires_at=now()-interval '1 day' WHERE id=$1",[e.visitorId]);
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=now()-interval '1 day' WHERE visitor_id=$1",[e.visitorId]);
    const brokenPool={connect:async()=>{
      const raw=await app.connect();
      return {query:(text,values)=>{
        if(text.startsWith('DELETE FROM world_pulse.visitors')) throw new Error('injected-delete-failure');
        return raw.query(text,values);
      },release:()=>raw.release()};
    }};
    await assert.rejects(()=>consolidateInactive(brokenPool),/injected-delete-failure/);
    const totals=await owner.query('SELECT participants::text,credited_seconds::text FROM world_pulse.tag_history_totals WHERE tag_id=$1',[tag.id]);
    assert.deepEqual(totals.rows[0],{participants:'2',credited_seconds:'30'});
    assert.equal((await owner.query('SELECT id FROM world_pulse.visitors WHERE id=$1',[e.visitorId])).rows.length,1);
    assert.deepEqual(await consolidateInactive(app),{consolidatedVisitors:1});
    assert.equal((await history()).historicalParticipants,'5');
    assert.equal((await history()).creditedSeconds,'36');
    await assert.rejects(()=>consolidateInactive(app,{limit:0}),RangeError);

    const f=await createVisitor(),g=await createVisitor();
    for(const v of [f,g]) await selectTag(v.visitorId,tag.id);
    await owner.query("UPDATE world_pulse.visitors SET last_seen_at=now()-interval '60 days',expires_at=now()-interval '1 day' WHERE id=ANY($1::uuid[])",[[f.visitorId,g.visitorId]]);
    const blocker=await owner.connect();
    try {
      await blocker.query('BEGIN');await blocker.query('SELECT id FROM world_pulse.visitors WHERE id=$1 FOR UPDATE',[f.visitorId]);
      assert.deepEqual(await consolidateInactive(app),{consolidatedVisitors:1},'locked visitor is skipped, not double-counted');
    } finally {await blocker.query('ROLLBACK');blocker.release();}
    assert.deepEqual(await consolidateInactive(app),{consolidatedVisitors:1});
    assert.equal((await history()).historicalParticipants,'7');
    assert.equal((await history()).creditedSeconds,'36');
  });

  await t.test('More than 200 historical balances cannot hide selection or positive time',async()=>{
    const visitor=await createVisitor();
    const {rows}=await owner.query(`INSERT INTO world_pulse.tags(id,normalized,color)
      SELECT gen_random_uuid(),'many_balances_'||n,'#aabbcc' FROM generate_series(1,205) n RETURNING id`);
    const ids=rows.map(row=>row.id).sort();const selected=ids.at(-1),positive=ids.at(-2);
    await owner.query(`INSERT INTO world_pulse.visitor_tags(visitor_id,tag_id,seconds,expires_at)
      SELECT $1,id,10,now()-interval '8 days' FROM world_pulse.tags WHERE id=ANY($2::uuid[])`,[visitor.visitorId,ids]);
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=now()+interval '1 hour' WHERE visitor_id=$1 AND tag_id=$2",[visitor.visitorId,positive]);
    await selectTag(visitor.visitorId,selected);
    let credits=await getCredits(visitor.visitorId);
    assert.equal(credits.length,201,'one extra row signals the HTTP display limit');
    assert.equal(credits[0].tagId,selected);assert.equal(credits[0].remainingMs,0);
    assert.equal(credits[1].tagId,positive);assert.ok(credits[1].remainingMs>3000000);
    await selectTag(visitor.visitorId,positive);credits=await getCredits(visitor.visitorId);
    assert.equal(credits[0].tagId,positive);assert.equal(credits[0].creditedSeconds,'10');
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM world_pulse.visitor_tags WHERE visitor_id=$1',[visitor.visitorId])).rows[0].n,205);
  });

  await t.test('Read-only retention inspection reports bounded eligibility without deleting sessions',async()=>{
    const {inspectInactive}=await import('../server/retention.mjs');
    const visitor=await createVisitor();
    await owner.query("UPDATE world_pulse.visitors SET last_seen_at=now()-interval '60 days' WHERE id=$1",[visitor.visitorId]);
    assert.deepEqual(await inspectInactive(app,{limit:1}),{eligibleAtLeast:1,capped:true});
    assert.equal((await owner.query('SELECT id FROM world_pulse.visitors WHERE id=$1',[visitor.visitorId])).rows.length,1);
    await assert.rejects(()=>inspectInactive(app,{limit:10001}),RangeError);
  });

  await t.test('Country consent, suppression, cache and withdrawal preserve current participation', async()=>{
    const {setCountryConsent,getCountrySnapshot}=await import('../server/store.mjs');
    const tag=await createOrGetTag('#aaa_geo');const visitors=[];
    for(let i=0;i<8;i++){
      const visitor=await createVisitor();visitors.push(visitor);
      await selectTag(visitor.visitorId,tag.id);
      await creditBatch(visitor.visitorId,{tagId:tag.id,batchId:randomUUID(),clicks:30});
      if(i<7)await setCountryConsent(visitor.visitorId,true,i<5?'PT':'BR');
    }
    await owner.query('DELETE FROM world_pulse.country_snapshot_cache');
    let snapshot=await getCountrySnapshot();let geo=snapshot.tags.find(t=>t.id===tag.id);
    assert.equal(geo.activeParticipants,'8');
    assert.deepEqual(geo.countries,[{countryCode:'OTHER',activeParticipants:'2'},{countryCode:'PT',activeParticipants:'5'},{countryCode:'ZZ',activeParticipants:'1'}]);
    for(const v of visitors)assert.ok(!JSON.stringify(snapshot).includes(v.visitorId));
    assert.equal(snapshot.asOfMs%5000,0);assert.equal(snapshot.validUntilMs,snapshot.asOfMs+5000);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM world_pulse.country_snapshot_cache')).rows[0].n,1);
    await setCountryConsent(visitors[0].visitorId,false,'PT');
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM world_pulse.country_snapshot_cache')).rows[0].n,0);
    const stored=await owner.query('SELECT country_code,country_consent,country_consent_at FROM world_pulse.visitors WHERE id=$1',[visitors[0].visitorId]);
    assert.equal(stored.rows[0].country_code,'ZZ');assert.equal(stored.rows[0].country_consent,false);assert.ok(stored.rows[0].country_consent_at);
    snapshot=await getCountrySnapshot();geo=snapshot.tags.find(t=>t.id===tag.id);
    assert.equal(geo.activeParticipants,'8','withdrawing country never removes a positive balance');
    assert.deepEqual(geo.countries,[{countryCode:'OTHER',activeParticipants:'6'},{countryCode:'ZZ',activeParticipants:'2'}]);
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=now()-interval '1 minute' WHERE visitor_id=$1 AND tag_id=$2",[visitors[1].visitorId,tag.id]);
    await owner.query('DELETE FROM world_pulse.country_snapshot_cache');
    geo=(await getCountrySnapshot()).tags.find(t=>t.id===tag.id);
    assert.equal(geo.activeParticipants,'7');
    await findVisitor(visitors[2].token,'XX');
    assert.equal((await owner.query('SELECT country_code FROM world_pulse.visitors WHERE id=$1',[visitors[2].visitorId])).rows[0].country_code,'ZZ');
  });

  await t.test('Regional points: explicit cell, one active pair, grouping, withdrawal cache invalidation and expiry',async()=>{
    const {setRegionCell,getRegionSnapshot}=await import('../server/store.mjs');
    const {regionCell}=await import('../server/regionGrid.mjs');
    const cell=regionCell(38.72,-9.14),tag=await createOrGetTag('region_'+randomUUID().slice(0,8));
    const visitors=[await createVisitor(),await createVisitor()];
    for(const v of visitors){await selectTag(v.visitorId,tag.id);await creditBatch(v.visitorId,{batchId:randomUUID(),tagId:tag.id,clicks:30});}
    assert.equal((await getRegionSnapshot()).cells.filter(row=>row.tagId===tag.id).length,0,'country/session alone is not regional consent');
    await setRegionCell(visitors[0].visitorId,cell,'PT');
    const shared=(await owner.query('SELECT country_consent,country_code FROM world_pulse.visitors WHERE id=$1',[visitors[0].visitorId])).rows[0];
    assert.deepEqual(shared,{country_consent:true,country_code:'PT'});
    let row=(await getRegionSnapshot()).cells.find(row=>row.tagId===tag.id);
    assert.equal(row.participants,'1');assert.equal(row.cell,cell);
    assert.deepEqual(Object.keys(row).sort(),['cell','color','name','participants','tagId']);
    await setRegionCell(visitors[1].visitorId,cell);
    assert.equal((await getRegionSnapshot()).cells.find(row=>row.tagId===tag.id).participants,'2');
    await assert.rejects(setRegionCell(visitors[0].visitorId,'r1:999:1'));
    await setRegionCell(visitors[0].visitorId,null);
    const withdrawn=(await owner.query('SELECT country_consent,country_code,region_cell FROM world_pulse.visitors WHERE id=$1',[visitors[0].visitorId])).rows[0];
    assert.deepEqual(withdrawn,{country_consent:false,country_code:'ZZ',region_cell:null});
    assert.equal((await getRegionSnapshot()).cells.find(row=>row.tagId===tag.id).participants,'1');
    assert.ok((await getCredits(visitors[0].visitorId))[0].remainingMs>0,'withdrawal preserves balance');
    await owner.query("UPDATE world_pulse.visitor_tags SET expires_at=now()-interval '1 minute' WHERE visitor_id=$1",[visitors[1].visitorId]);
    await owner.query('DELETE FROM world_pulse.region_snapshot_cache');
    assert.equal((await getRegionSnapshot()).cells.filter(row=>row.tagId===tag.id).length,0);
  });

});
