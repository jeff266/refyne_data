-- ============================================================
-- Migration 077: RLS for org-specific tables
-- ============================================================
-- Critical security fix: Add Row Level Security to 9 org-specific
-- tables that were missing protection. All application code uses
-- supabaseAdmin (service role) which bypasses RLS, so these policies
-- protect against direct client-side access and Supabase dashboard
-- exposure only.
-- ============================================================

-- Helper: Clerk JWT puts org_id in JWT claims as 'org_id'
-- RLS policies extract it via: auth.jwt() ->> 'org_id'

-- 1. dedup_policies (CRITICAL - just added in migration 076!)
ALTER TABLE dedup_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_policies_org_isolation ON dedup_policies
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- 2. dedup_decisions
ALTER TABLE dedup_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_decisions_org_isolation ON dedup_decisions
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- 3. dedup_auto_merge_settings
ALTER TABLE dedup_auto_merge_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_auto_merge_settings_org_isolation ON dedup_auto_merge_settings
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- 4. dedup_survivorship_rules
-- Allow reading global defaults (org_id IS NULL) + own org rules
-- Only allow inserting/updating own org rules
ALTER TABLE dedup_survivorship_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY dedup_survivorship_rules_select ON dedup_survivorship_rules
  FOR SELECT
  USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY dedup_survivorship_rules_insert ON dedup_survivorship_rules
  FOR INSERT
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY dedup_survivorship_rules_update ON dedup_survivorship_rules
  FOR UPDATE
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY dedup_survivorship_rules_delete ON dedup_survivorship_rules
  FOR DELETE
  USING (org_id = (auth.jwt() ->> 'org_id'));

-- 5. enrichment_field_sources
ALTER TABLE enrichment_field_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrichment_field_sources_org_isolation ON enrichment_field_sources
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- 6. harmony_field_assignments
-- Allow reading global defaults (org_id IS NULL) + own org assignments
-- Only allow inserting/updating own org assignments
ALTER TABLE harmony_field_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY harmony_field_assignments_select ON harmony_field_assignments
  FOR SELECT
  USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY harmony_field_assignments_insert ON harmony_field_assignments
  FOR INSERT
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY harmony_field_assignments_update ON harmony_field_assignments
  FOR UPDATE
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY harmony_field_assignments_delete ON harmony_field_assignments
  FOR DELETE
  USING (org_id = (auth.jwt() ->> 'org_id'));

-- 7. job_segmentation_runs
ALTER TABLE job_segmentation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_segmentation_runs_org_isolation ON job_segmentation_runs
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- 8. normalization_run_progress
-- No direct org_id column. Join to normalization_runs for org isolation.
ALTER TABLE normalization_run_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY normalization_run_progress_org_isolation ON normalization_run_progress
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM normalization_runs nr
      WHERE nr.id = normalization_run_progress.run_id
      AND nr.org_id = (auth.jwt() ->> 'org_id')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM normalization_runs nr
      WHERE nr.id = normalization_run_progress.run_id
      AND nr.org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- 9. taxonomy_suggestions
ALTER TABLE taxonomy_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY taxonomy_suggestions_org_isolation ON taxonomy_suggestions
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- ============================================================
-- Global tables: add read-only RLS for defense in depth
-- ============================================================
-- These tables contain shared taxonomy data, no org isolation needed.
-- Add read-only policies to allow authenticated access while preventing
-- accidental modifications via client-side code.

-- sub_industry_packs (global taxonomy packs)
ALTER TABLE sub_industry_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_industry_packs_read_all ON sub_industry_packs
  FOR SELECT
  USING (true);

-- sub_industry_pack_entries (global taxonomy entries)
ALTER TABLE sub_industry_pack_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_industry_pack_entries_read_all ON sub_industry_pack_entries
  FOR SELECT
  USING (true);

-- job_title_cache (global job title normalization cache)
ALTER TABLE job_title_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_title_cache_read_all ON job_title_cache
  FOR SELECT
  USING (true);

-- ============================================================
-- Verification query (run after applying):
-- ============================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--   'dedup_policies', 'dedup_decisions', 'dedup_auto_merge_settings',
--   'dedup_survivorship_rules', 'enrichment_field_sources',
--   'harmony_field_assignments', 'job_segmentation_runs',
--   'normalization_run_progress', 'taxonomy_suggestions',
--   'sub_industry_packs', 'sub_industry_pack_entries', 'job_title_cache'
-- )
-- ORDER BY tablename;
--
-- All should show rowsecurity = true
-- ============================================================
