import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { beginLimitedTransaction } from '../server/databaseLimits.mjs';
import { consolidateInactive } from '../server/retention.mjs';

// Deliberately pinned to the disposable branch, never an arbitrary DATABASE_URL.
export const stagingEndpoint = 'ep-misty-glade-za9nxlhg';
export const stagingExpiresAt = '2026-10-31T01:15:25Z';
export function validateStagingUrl(value, owner = false, now = Date.now()) {
  if (now >= Date.parse(stagingExpiresAt)) throw new Error('staging_expired');
  const url = new URL(value);
  const host = `${stagingEndpoint}${owner ? '' : '-pooler'}.c-2.eu-west-2.aws.neon.tech`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== host ||
      url.port || url.pathname !== '/neondb' ||
      url.username !== (owner ? 'neondb_owner' : 'world_pulse_app') || !url.password ||
      url.searchParams.get('sslmode') !== 'verify-full') throw new Error('staging_target_rejected');
  return url.toString();
}

export async function checkStaging(connectionString) {
  const db = new pg.Client({ connectionString: validateStagingUrl(connectionString), connectionTimeoutMillis: 15_000,
    query_timeout: 6000 });
  try {
    await db.connect();
    await beginLimitedTransaction(db);
    const { rows: [role] } = await db.query(`SELECT current_user AS name, rolsuper, rolcreatedb,
      rolcreaterole, rolinherit, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    if (role.name !== 'world_pulse_app' || role.rolsuper || role.rolcreatedb ||
        role.rolcreaterole || role.rolinherit || role.rolbypassrls) throw new Error('runtime_role_too_powerful');
    const { rows: [members] } = await db.query('SELECT count(*)::int AS n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)');
    if (members.n) throw new Error('runtime_membership_rejected');
    await db.query('SELECT id FROM world_pulse.tags LIMIT 0');
    await db.query('SELECT expires_at FROM world_pulse.visitor_tags LIMIT 0');
    await db.query('SELECT scope FROM world_pulse.operation_budgets LIMIT 0');
    await db.query('SELECT last_seen_at FROM world_pulse.visitors LIMIT 0');
    await db.query('SELECT participants FROM world_pulse.tag_history_totals LIMIT 0');
    const {rows:[timeouts]}=await db.query(`SELECT current_setting('statement_timeout') AS statement,
      current_setting('lock_timeout') AS lock`);
    if (timeouts.statement !== '5s' || timeouts.lock !== '1s') throw new Error('runtime_timeouts_not_applied');
    try {
      await db.query('CREATE TABLE world_pulse.__staging_permission_probe(id int)');
      throw new Error('runtime_ddl_allowed');
    } catch (error) {
      if (error.code !== '42501') throw error;
    } finally { await db.query('ROLLBACK'); }
    console.log('Staging TLS, schema including budgets, pooler timeouts, role restrictions and DDL denial verified.');
  } finally { await db.end(); }
}

export async function migrateStaging(ownerUrl, runtimeUrl) {
  validateStagingUrl(runtimeUrl);
  const db = new pg.Client({ connectionString: validateStagingUrl(ownerUrl, true), connectionTimeoutMillis: 15_000 });
  try {
    await db.connect();
    // Neon disallows writing SUPERUSER/BYPASSRLS attributes even to false.
    // They are asserted false by checkStaging instead.
    await db.query('ALTER ROLE world_pulse_app NOCREATEDB NOCREATEROLE NOINHERIT');
    const { rows } = await db.query(`SELECT m.rolname FROM pg_auth_members a
      JOIN pg_roles m ON m.oid=a.roleid JOIN pg_roles r ON r.oid=a.member WHERE r.rolname='world_pulse_app'`);
    if (rows.length) throw new Error('unexpected_runtime_membership');
    for (const file of ['0001-runtime-access.sql', '0002-participation-core.sql', '0003-time-balances.sql', '0004-operation-budgets.sql', '0005-retention-rollups.sql']) {
      await db.query(await readFile(new URL(`sql/${file}`, import.meta.url), 'utf8'));
      console.log(`Staging migration applied: ${file}`);
    }
  } finally { await db.end(); }
  await checkStaging(runtimeUrl);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.WP_STAGING_OPERATION === 'migrate') {
      await migrateStaging(process.env.DATABASE_MIGRATION_URL, process.env.DATABASE_URL);
    } else if (process.env.WP_STAGING_OPERATION === 'check') {
      await checkStaging(process.env.DATABASE_URL);
    } else if (process.env.WP_STAGING_OPERATION === 'maintain') {
      const pool=new pg.Pool({connectionString:validateStagingUrl(process.env.DATABASE_URL),max:1,query_timeout:6000,connectionTimeoutMillis:15000});
      try { console.log(JSON.stringify(await consolidateInactive(pool,{limit:100}))); }
      finally {await pool.end();}
    } else throw new Error('explicit_staging_operation_required');
  } catch (error) {
    // Drivers can embed credentials in errors. Never print private error objects.
    console.error('Staging database operation failed; verify target, expiry, schema and role permissions.');
    const safeReasons = ['staging_expired','staging_target_rejected','runtime_role_too_powerful',
      'runtime_membership_rejected','runtime_timeouts_not_applied','runtime_ddl_allowed',
      'explicit_staging_operation_required','unexpected_runtime_membership'];
    if (safeReasons.includes(error.message)) console.error(`Safe failure reason: ${error.message}`);
    if (/^[0-9A-Z]{5}$/.test(error.code ?? '')) console.error(`SQLSTATE: ${error.code}`);
    process.exitCode = 1;
  }
}
