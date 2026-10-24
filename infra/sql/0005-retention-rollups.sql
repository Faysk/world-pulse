-- Approved policy: >30 days without return AND all balances expired.
-- Existing rows get a fresh 30-day grace; past visits were not fully tracked.
BEGIN;
ALTER TABLE world_pulse.visitors ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT statement_timestamp();
CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON world_pulse.visitors(last_seen_at);
CREATE TABLE IF NOT EXISTS world_pulse.tag_history_totals (
  tag_id uuid PRIMARY KEY REFERENCES world_pulse.tags(id),
  participants numeric(40,0) NOT NULL DEFAULT 0 CHECK (participants >= 0),
  credited_seconds numeric(40,0) NOT NULL DEFAULT 0 CHECK (credited_seconds >= 0)
);
GRANT SELECT, INSERT, UPDATE ON world_pulse.tag_history_totals TO world_pulse_app;
REVOKE DELETE ON world_pulse.tag_history_totals FROM world_pulse_app;
COMMIT;
