import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

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
  const db = new pg.Client({ connectionString: validateStagingUrl(connectionString), connectionTimeoutMillis: 15_000 });
  try {
    await db.connect();
    const { rows: [role] } = await db.query(`SELECT current_user AS name, rolsuper, rolcreatedb,
      rolcreaterole, rolinherit, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    if (role.name !== 'world_pulse_app' || role.rolsuper || role.rolcreatedb ||
        role.rolcreaterole || role.rolinherit || role.rolbypassrls) throw new Error('runtime_role_too_powerful');
    const { rows: [members] } = await db.query('SELECT count(*)::int AS n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)');
    if (members.n) throw new Error('runtime_membership_rejected');
    await db.query('SELECT id FROM world_pulse.tags LIMIT 0');
    await db.query('SELECT expires_at FROM world_pulse.visitor_tags LIMIT 0');
    await db.query('BEGIN');
    try {
      await db.query('CREATE TABLE world_pulse.__staging_permission_probe(id int)');
      throw new Error('runtime_ddl_allowed');
    } catch (error) {
      if (error.code !== '42501') throw error;
    } finally { await db.query('ROLLBACK'); }
    console.log('Staging TLS, schema, role restrictions and DDL denial verified.');
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
    for (const file of ['0001-runtime-access.sql', '0002-participation-core.sql', '0003-time-balances.sql']) {
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
    } else throw new Error('explicit_staging_operation_required');
  } catch {
    // Drivers can embed credentials in errors. Never print private error objects.
    console.error('Staging database operation failed; verify target, expiry, schema and role permissions.');
    process.exitCode = 1;
  }
}
