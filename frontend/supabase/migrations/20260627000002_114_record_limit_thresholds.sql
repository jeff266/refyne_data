-- Migration 114: Record Limit Thresholds and Grace Period
--
-- Adds threshold monitoring fields to hubspot_record_counts and creates
-- record_limit_notifications table for tracking sent alerts.
--
-- Thresholds:
-- - Warning: 90% of plan limit
-- - Hard gate: 100% of plan limit
-- - Grace period: 14 days from first hard gate detection

-- ============================================================================
-- Schema Discovery (for reference)
-- ============================================================================
-- Current hubspot_record_counts columns:
-- id, org_id, portal_id, company_count, contact_count, total_records,
-- suggested_plan, fetched_at, created_at

-- ============================================================================
-- Add Threshold Tracking Fields
-- ============================================================================

ALTER TABLE public.hubspot_record_counts
  ADD COLUMN IF NOT EXISTS is_over_limit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_near_limit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS over_limit_first_detected_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grace_period_expired BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- record_limit_notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.record_limit_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'near_limit',
    'over_limit',
    'grace_period_warning',
    'grace_period_expired'
  )),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  total_records INTEGER NOT NULL,
  plan_limit INTEGER NOT NULL
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_record_limit_notifications_org_id
  ON record_limit_notifications(org_id);

CREATE INDEX idx_record_limit_notifications_sent_at
  ON record_limit_notifications(org_id, sent_at DESC);

CREATE INDEX idx_record_limit_notifications_type
  ON record_limit_notifications(org_id, notification_type, sent_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE record_limit_notifications ENABLE ROW LEVEL SECURITY;

-- Org isolation: users can only see their own org's notifications
CREATE POLICY record_limit_notifications_org_isolation
  ON record_limit_notifications
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Service role bypass
CREATE POLICY record_limit_notifications_service_role
  ON record_limit_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
