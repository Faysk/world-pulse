-- Apply manually as the migration owner after 0002. Deploy never applies SQL.
-- Historical credits do not prove unexpired participation: start old balances
-- expired rather than inventing live activity during migration.
BEGIN;
ALTER TABLE world_pulse.visitor_tags
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL
  DEFAULT '1970-01-01 00:00:00+00';
COMMIT;
