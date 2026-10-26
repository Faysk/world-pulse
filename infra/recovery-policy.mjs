// Run as the new database owner, before exposing a recovered database.
// Historical consent may predate a withdrawal: no recovered geography is public.
export const recoveryPrivacySql=`BEGIN;
  UPDATE world_pulse.visitors SET region_cell=NULL,region_shared_at=NULL,
    country_consent=false,country_consent_at=NULL,country_code='ZZ';
  TRUNCATE world_pulse.region_snapshot_cache,world_pulse.country_snapshot_cache,world_pulse.operation_budgets;
  COMMIT;`;
export const recoveryGrantsSql=`REVOKE ALL ON SCHEMA world_pulse FROM PUBLIC;
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  GRANT USAGE ON SCHEMA world_pulse TO world_pulse_app;
  GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA world_pulse TO world_pulse_app;
  GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA world_pulse TO world_pulse_app;
  ALTER ROLE world_pulse_app SET search_path TO world_pulse,public;`;

export function recoveryFixtureContext(env){
  if(env.WP_RECOVERY_DRILL!=='synthetic-loopback'||!/^([0-9a-f]{12}|[0-9a-f]{64})$/.test(env.WP_RECOVERY_CONTAINER??'')||
    ['DATABASE_URL','DATABASE_MIGRATION_URL','VERCEL_TOKEN','WP_BACKUP_ENCRYPTION_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BACKUP_ACCESS_KEY_ID','R2_BACKUP_SECRET_ACCESS_KEY'].some(key=>env[key]))throw new Error('recovery_fixture_context_rejected');
  return env.WP_RECOVERY_CONTAINER;
}
