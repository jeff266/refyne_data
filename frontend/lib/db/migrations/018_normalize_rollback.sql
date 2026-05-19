-- Migration: 018_normalize_rollback.sql
-- Adds rollback capability for Normalize operations

-- ── Normalization runs ─────────────────────────────────────────────
CREATE TABLE normalization_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            text        NOT NULL,
  connection_id     uuid        NOT NULL REFERENCES hubspot_connections(id),
  initiated_by      text        NOT NULL,   -- Clerk user_id
  status            text        NOT NULL DEFAULT 'running'
    CHECK (status IN (
      'running','completed','failed','rolled_back','rolling_back'
    )),
  scope             jsonb       NOT NULL,
    -- { type: 'all' | 'list' | 'filter', listId?, filters? }
  harmonies_applied jsonb       NOT NULL,   -- array of harmony IDs run
  records_scanned   int         NOT NULL DEFAULT 0,
  records_changed   int         NOT NULL DEFAULT 0,
  records_failed    int         NOT NULL DEFAULT 0,
  rollback_available boolean    NOT NULL DEFAULT true,
  rollback_expires_at timestamptz NOT NULL,
    -- 30 days from run completion
  rolled_back_at    timestamptz,
  rolled_back_by    text,
  error_message     text,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

-- ── Per-record field changes ───────────────────────────────────────
CREATE TABLE normalization_changes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid        NOT NULL
    REFERENCES normalization_runs(id) ON DELETE CASCADE,
  org_id          text        NOT NULL,
  hubspot_company_id text     NOT NULL,
  field_name      text        NOT NULL,
  value_before    text,
  value_after     text,
  harmony_id      text,
  harmony_name    text,
  status          text        NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied','rolled_back','skipped')),
  applied_at      timestamptz NOT NULL DEFAULT now(),
  rolled_back_at  timestamptz
);

-- ── Indexes ────────────────────────────────────────────────────────
CREATE INDEX norm_runs_org_date
  ON normalization_runs (org_id, started_at DESC);
CREATE INDEX norm_changes_run
  ON normalization_changes (run_id);
CREATE INDEX norm_changes_org_company
  ON normalization_changes (org_id, hubspot_company_id);
CREATE INDEX norm_changes_status
  ON normalization_changes (run_id, status);

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE normalization_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalization_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON normalization_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));
CREATE POLICY "org_isolation" ON normalization_changes
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- ── Cleanup function (runs via cron) ──────────────────────────────
-- Marks runs as rollback_unavailable after 30 days
-- Does NOT delete change records (kept for audit)
CREATE OR REPLACE FUNCTION expire_rollback_windows()
RETURNS void AS $$
  UPDATE normalization_runs
  SET rollback_available = false
  WHERE rollback_expires_at < now()
    AND rollback_available = true;
$$ LANGUAGE SQL;
