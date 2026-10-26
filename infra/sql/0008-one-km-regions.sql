BEGIN;
-- Additive precision version: existing r1 data stays unchanged.
ALTER TABLE world_pulse.visitors DROP CONSTRAINT IF EXISTS visitors_region_cell_check;
ALTER TABLE world_pulse.visitors ADD CONSTRAINT visitors_region_cell_check
  CHECK(region_cell IS NULL OR region_cell ~ '^r1:[0-9]{1,3}:[0-9]{1,3}$' OR region_cell ~ '^r2:[0-9]{1,5}:[0-9]{1,5}$');
DELETE FROM world_pulse.region_snapshot_cache;
COMMIT;
