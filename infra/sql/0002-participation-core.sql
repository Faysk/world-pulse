-- World Pulse MVP participation model.
-- IMPORTANT: operator must approve and apply AS DATABASE OWNER, never using DATABASE_URL.
-- Must run after 0001-runtime-access.sql; do not auto-apply during deploy.
-- No raw IP, exact GPS, user-agent or device fingerprint is stored.
BEGIN;
CREATE TABLE IF NOT EXISTS world_pulse.tags (
  id uuid PRIMARY KEY,
  normalized varchar(32) NOT NULL UNIQUE,
  color char(7) NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_normalized CHECK (char_length(normalized) BETWEEN 2 AND 32)
);
CREATE TABLE IF NOT EXISTS world_pulse.visitors (
  id uuid PRIMARY KEY,
  session_hash char(64) NOT NULL UNIQUE,
  active_tag_id uuid REFERENCES world_pulse.tags(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visitors_expiry_idx ON world_pulse.visitors(expires_at);
CREATE TABLE IF NOT EXISTS world_pulse.visitor_tags (
  visitor_id uuid NOT NULL REFERENCES world_pulse.visitors(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES world_pulse.tags(id),
  seconds bigint NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  selected_at timestamptz NOT NULL DEFAULT now(),
  first_tap_at timestamptz,
  last_tap_at timestamptz,
  PRIMARY KEY (visitor_id, tag_id)
);
CREATE INDEX IF NOT EXISTS visitor_tags_ranking_idx ON world_pulse.visitor_tags(tag_id) WHERE seconds > 0;
CREATE TABLE IF NOT EXISTS world_pulse.tap_batches (
  visitor_id uuid NOT NULL REFERENCES world_pulse.visitors(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES world_pulse.tags(id),
  clicks smallint NOT NULL CHECK (clicks BETWEEN 1 AND 30),
  fingerprint char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, batch_id)
);
CREATE INDEX IF NOT EXISTS tap_batches_recent_idx ON world_pulse.tap_batches(visitor_id, created_at DESC);

-- Existing infrastructure baseline sets ALTER DEFAULT PRIVILEGES; apply
-- explicit DML grants too, in case the migration owner differs from the
-- role whose defaults were previously configured.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  world_pulse.tags, world_pulse.visitors,
  world_pulse.visitor_tags, world_pulse.tap_batches
  TO world_pulse_app;
COMMIT;
