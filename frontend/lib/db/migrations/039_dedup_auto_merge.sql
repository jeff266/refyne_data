-- Migration 039: Dedup Auto-merge
-- Adds auto-merge scheduling, cancellation tracking, and org-level settings

-- Add auto-merge tracking columns to dedup_clusters
ALTER TABLE dedup_clusters
ADD COLUMN auto_merge_scheduled_at timestamptz,
ADD COLUMN auto_merge_cancelled_at timestamptz,
ADD COLUMN auto_merge_cancelled_by text;

-- Index for efficiently finding clusters due for auto-merge
CREATE INDEX idx_dedup_clusters_auto_merge
ON dedup_clusters(auto_merge_scheduled_at)
WHERE auto_merge_scheduled_at IS NOT NULL
  AND status = 'pending'
  AND auto_merge_cancelled_at IS NULL;

-- Auto-merge settings per org
CREATE TABLE public.dedup_auto_merge_settings (
  org_id              text PRIMARY KEY,
  enabled             boolean DEFAULT false,
  confidence_threshold numeric DEFAULT 0.97,
  waiting_period_hours integer DEFAULT 24,
  notify_email        text,
  notify_slack_webhook text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

COMMENT ON TABLE public.dedup_auto_merge_settings IS 'Auto-merge settings per organization. High-confidence clusters automatically merge after waiting period unless cancelled.';
COMMENT ON COLUMN public.dedup_auto_merge_settings.confidence_threshold IS 'Minimum confidence (0-1) for auto-merge eligibility. Default 0.97.';
COMMENT ON COLUMN public.dedup_auto_merge_settings.waiting_period_hours IS 'Hours to wait before auto-merge executes. Default 24.';
