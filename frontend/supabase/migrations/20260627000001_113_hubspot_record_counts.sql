-- Migration 113: HubSpot Record Counts and Plan Suggestions
--
-- Creates table to track HubSpot portal record counts and suggest
-- appropriate billing plans based on total record volume.
--
-- Fetched after OAuth connection completes via background job.

-- ============================================================================
-- hubspot_record_counts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hubspot_record_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  portal_id TEXT NOT NULL,

  -- Record counts
  company_count INTEGER NOT NULL,
  contact_count INTEGER NOT NULL,
  total_records INTEGER NOT NULL,

  -- Plan suggestion based on volume
  suggested_plan TEXT NOT NULL CHECK (suggested_plan IN (
    'starter', 'growth', 'scale', 'enterprise'
  )),

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_hubspot_record_counts_org_id
  ON hubspot_record_counts(org_id);

CREATE INDEX idx_hubspot_record_counts_portal_id
  ON hubspot_record_counts(portal_id);

CREATE INDEX idx_hubspot_record_counts_fetched_at
  ON hubspot_record_counts(org_id, fetched_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE hubspot_record_counts ENABLE ROW LEVEL SECURITY;

-- Org isolation: users can only see their own org's record counts
CREATE POLICY hubspot_record_counts_org_isolation
  ON hubspot_record_counts
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Service role bypass
CREATE POLICY hubspot_record_counts_service_role
  ON hubspot_record_counts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
