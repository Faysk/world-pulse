// Conservative alpha operational defaults, NOT provider free-plan guarantees.
export const OPERATION_BUDGETS = Object.freeze({
  requests: Object.freeze([['requests_minute',60,3000],['requests_day',86400,50000]]),
  reads: Object.freeze([['reads_minute',60,600]]),
  sessions: Object.freeze([['sessions_hour',3600,2000]]),
  tags: Object.freeze([['tags_hour',3600,500]])
});

export async function chargeBudget(database, category) {
  const budget = OPERATION_BUDGETS[category];
  if (!budget) throw new RangeError('Unknown operation budget');
  const result = await database.query(`
    INSERT INTO world_pulse.operation_budgets AS current (scope,window_start,used)
    SELECT scope, to_timestamp(floor(extract(epoch FROM statement_timestamp())/seconds)*seconds), 1
    FROM unnest($1::text[],$2::int[],$3::int[]) AS limits(scope,seconds,maximum)
    ORDER BY scope
    ON CONFLICT (scope) DO UPDATE SET
      window_start=EXCLUDED.window_start,
      used=CASE WHEN current.window_start<EXCLUDED.window_start THEN 1 ELSE current.used+1 END
    WHERE current.window_start<EXCLUDED.window_start OR (
      current.window_start=EXCLUDED.window_start AND current.used < (
        SELECT maximum FROM unnest($1::text[],$3::int[]) AS limits(scope,maximum)
        WHERE limits.scope=current.scope
      )
    )
    RETURNING scope
  `,[budget.map(b=>b[0]),budget.map(b=>b[1]),budget.map(b=>b[2])]);
  return result.rowCount === budget.length;
}
