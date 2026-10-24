BEGIN;
ALTER TABLE world_pulse.visitors ADD COLUMN IF NOT EXISTS country_consent boolean NOT NULL DEFAULT false;
ALTER TABLE world_pulse.visitors ADD COLUMN IF NOT EXISTS country_consent_at timestamptz;
ALTER TABLE world_pulse.visitors ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'ZZ'
  CHECK(country_code ~ '^[A-Z]{2}$');
CREATE TABLE IF NOT EXISTS world_pulse.country_snapshot_cache (
  key boolean PRIMARY KEY DEFAULT true CHECK(key),
  window_start timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object')
);
GRANT SELECT,INSERT,UPDATE,DELETE ON world_pulse.country_snapshot_cache TO world_pulse_app;
COMMIT;
