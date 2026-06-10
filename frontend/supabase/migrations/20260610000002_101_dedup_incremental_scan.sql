-- Migration 101: Dedup Incremental Scanning
-- Add scan tracking to dedup_config and support for stale clusters

-- ================================================================
-- Scan Tracking Columns
-- ================================================================

ALTER TABLE public.dedup_config
  ADD COLUMN IF NOT EXISTS last_full_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_incremental_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_companies_last_scan INTEGER,
  ADD COLUMN IF NOT EXISTS incremental_companies_last_scan INTEGER;

COMMENT ON COLUMN public.dedup_config.last_full_scan_at IS 'Timestamp of last full dedup scan (all companies)';
COMMENT ON COLUMN public.dedup_config.last_incremental_scan_at IS 'Timestamp of last incremental scan (modified companies only)';
COMMENT ON COLUMN public.dedup_config.total_companies_last_scan IS 'Number of companies scanned in last full scan';
COMMENT ON COLUMN public.dedup_config.incremental_companies_last_scan IS 'Number of companies scanned in last incremental scan';

-- ================================================================
-- Indexes for Incremental Scanning
-- ================================================================

-- Index for fetching companies modified since last scan
CREATE INDEX IF NOT EXISTS idx_company_dedup_index_modified
  ON public.company_dedup_index(org_id, portal_id, last_modified_at DESC)
  WHERE last_modified_at IS NOT NULL;

-- Index for nightly scan scheduling (active connections only)
CREATE INDEX IF NOT EXISTS idx_hubspot_connections_active
  ON public.hubspot_connections(org_id)
  WHERE connection_status = 'active';

-- ================================================================
-- Add 'stale' Status to Clusters
-- ================================================================

-- Drop existing constraint if present
ALTER TABLE public.dedup_clusters
  DROP CONSTRAINT IF EXISTS dedup_clusters_status_check;

-- Add constraint with new 'stale' status
-- Stale clusters had a company's data change and need re-evaluation
ALTER TABLE public.dedup_clusters
  ADD CONSTRAINT dedup_clusters_status_check
  CHECK (status IN ('open', 'merged', 'rejected', 'invalid', 'stale'));

COMMENT ON CONSTRAINT dedup_clusters_status_check ON public.dedup_clusters IS 'Cluster status: open (needs review), merged (completed), rejected (not duplicates), invalid (company deleted), stale (company data changed, needs re-evaluation)';
