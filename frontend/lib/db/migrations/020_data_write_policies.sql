-- Migration: 020_data_write_policies.sql
-- AI Overviews + Data Write Behavior Defaults

-- ── Data write behavior defaults (org-level) ───────────────────────
ALTER TABLE workspace_entitlements
  ADD COLUMN IF NOT EXISTS existing_value_policy  text NOT NULL DEFAULT 'fill_gaps'
    CHECK (existing_value_policy IN (
      'fill_gaps',
      'overwrite_always',
      'overwrite_if_stale'
    )),
  ADD COLUMN IF NOT EXISTS overwrite_stale_days   int  NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS conflict_resolution    text NOT NULL DEFAULT 'first_wins'
    CHECK (conflict_resolution IN (
      'first_wins',
      'highest_confidence',
      'manual_review'
    )),
  ADD COLUMN IF NOT EXISTS dedup_preflight        boolean NOT NULL DEFAULT true;

-- ── AI summary audit log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_summaries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          text        NOT NULL,
  surface         text        NOT NULL
    CHECK (surface IN (
      'compliance_overview',
      'quarantine_triage',
      'rehearsal_summary'
    )),
  input_hash      text        NOT NULL,
  input_data      jsonb       NOT NULL,
  output_data     jsonb       NOT NULL,
  model           text        NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  tokens_used     int,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, surface, input_hash)
);

CREATE INDEX IF NOT EXISTS ai_summaries_org_surface
  ON ai_summaries (org_id, surface, created_at DESC);

ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON ai_summaries
  FOR ALL USING (org_id = current_setting('app.org_id', true));
