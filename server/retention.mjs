import { beginLimitedTransaction } from './databaseLimits.mjs';

export async function consolidateInactive(pool, {limit=100}={}) {
  if (!Number.isSafeInteger(limit) || limit<1 || limit>1000) throw new RangeError('Retention limit must be 1..1000');
  const client=await pool.connect();
  try {
    await beginLimitedTransaction(client);
    // The visitor lock is shared with selection/taps and authentication renewal.
    // No contribution can change between this eligibility check and consolidation.
    const {rows}=await client.query(`SELECT v.id FROM world_pulse.visitors v
      WHERE v.last_seen_at < statement_timestamp()-interval '30 days'
        AND NOT EXISTS (SELECT 1 FROM world_pulse.visitor_tags vt
          WHERE vt.visitor_id=v.id AND vt.expires_at>statement_timestamp())
      ORDER BY v.last_seen_at,v.id LIMIT $1 FOR UPDATE OF v SKIP LOCKED`,[limit]);
    const ids=rows.map(row=>row.id);
    if (ids.length) {
      await client.query(`INSERT INTO world_pulse.tag_history_totals AS totals(tag_id,participants,credited_seconds)
        SELECT tag_id,count(*),sum(seconds) FROM world_pulse.visitor_tags
        WHERE visitor_id=ANY($1::uuid[]) GROUP BY tag_id ORDER BY tag_id
        ON CONFLICT(tag_id) DO UPDATE SET participants=totals.participants+EXCLUDED.participants,
          credited_seconds=totals.credited_seconds+EXCLUDED.credited_seconds`,[ids]);
      // Cascades remove only these locked visitors' private pairs/batch IDs.
      // Rollups and deletion commit together; a retry cannot count the same pair twice.
      await client.query('DELETE FROM world_pulse.visitors WHERE id=ANY($1::uuid[])',[ids]);
    }
    await client.query('COMMIT');
    return {consolidatedVisitors:ids.length};
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
