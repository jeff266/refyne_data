-- Migration: 019_onboarding_progress.sql
-- Adds onboarding progress tracking per org

CREATE TABLE onboarding_progress (
  org_id              text PRIMARY KEY,
  connected_hubspot   boolean NOT NULL DEFAULT false,
  viewed_dashboard    boolean NOT NULL DEFAULT false,
  viewed_dedup        boolean NOT NULL DEFAULT false,
  applied_harmony     boolean NOT NULL DEFAULT false,
  ran_normalize       boolean NOT NULL DEFAULT false,
  completed_at        timestamptz,
  dismissed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policy: orgs can only access their own onboarding progress
CREATE POLICY "org_isolation" ON onboarding_progress
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Index for org lookups
CREATE INDEX IF NOT EXISTS onboarding_progress_org_idx ON onboarding_progress(org_id);
