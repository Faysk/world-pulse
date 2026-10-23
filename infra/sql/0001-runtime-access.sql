-- Infrastructure baseline, not the product/domain schema.
-- Execute as the database owner after creating world_pulse_app without membership grants.
CREATE SCHEMA IF NOT EXISTS world_pulse;
REVOKE ALL ON SCHEMA world_pulse FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA world_pulse TO world_pulse_app;
ALTER ROLE world_pulse_app SET search_path TO world_pulse, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA world_pulse
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO world_pulse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA world_pulse
  GRANT USAGE, SELECT ON SEQUENCES TO world_pulse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA world_pulse
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
