-- Apply as migration owner; never auto-run during deployment.
-- Five fixed counters, no IP, device identifier or unbounded per-request rows.
BEGIN;
CREATE TABLE IF NOT EXISTS world_pulse.operation_budgets (
  scope text PRIMARY KEY CHECK (scope IN ('requests_minute','requests_day','reads_minute','sessions_hour','tags_hour')),
  window_start timestamptz NOT NULL,
  used integer NOT NULL CHECK (used > 0)
);
GRANT SELECT, INSERT, UPDATE ON world_pulse.operation_budgets TO world_pulse_app;
REVOKE DELETE ON world_pulse.operation_budgets FROM world_pulse_app;
COMMIT;
