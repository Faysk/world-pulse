BEGIN;
ALTER TABLE world_pulse.visitors ADD COLUMN IF NOT EXISTS region_cell text
  CHECK(region_cell IS NULL OR region_cell ~ '^r1:[0-9]{1,3}:[0-9]{1,3}$');
ALTER TABLE world_pulse.visitors ADD COLUMN IF NOT EXISTS region_shared_at timestamptz;
CREATE INDEX IF NOT EXISTS visitors_region_cell_idx ON world_pulse.visitors(region_cell,id) WHERE region_cell IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitor_tags_region_expiry_idx ON world_pulse.visitor_tags(expires_at,visitor_id,tag_id);
CREATE TABLE IF NOT EXISTS world_pulse.region_snapshot_cache (
  key boolean PRIMARY KEY DEFAULT true CHECK(key),
  window_start timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object')
);
GRANT SELECT,INSERT,UPDATE,DELETE ON world_pulse.region_snapshot_cache TO world_pulse_app;
COMMIT;
