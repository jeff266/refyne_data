-- ============================================================
-- Migration XXX: [Brief description]
-- ============================================================
-- RLS: Required if table has org_id column
-- Pattern: CREATE POLICY {table}_org_isolation ON {table}
--   USING (org_id = (auth.jwt() ->> 'org_id'));
-- ============================================================

-- Example 1: Org-specific table (has org_id column)
-- ============================================================

-- CREATE TABLE example_org_specific (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   org_id text NOT NULL,
--   name text,
--   created_at timestamptz DEFAULT now()
-- );

-- CRITICAL: Enable RLS immediately after creating org-specific table
-- ALTER TABLE example_org_specific ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY example_org_specific_org_isolation ON example_org_specific
--   FOR ALL
--   USING (org_id = (auth.jwt() ->> 'org_id'))
--   WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));


-- Example 2: Global/shared table (no org_id column)
-- ============================================================

-- CREATE TABLE example_global_cache (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   key text NOT NULL UNIQUE,
--   value jsonb,
--   created_at timestamptz DEFAULT now()
-- );

-- Defense in depth: Enable read-only RLS for global tables
-- ALTER TABLE example_global_cache ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY example_global_cache_read_all ON example_global_cache
--   FOR SELECT
--   USING (true);


-- Example 3: Table with nullable org_id (global defaults + org-specific)
-- ============================================================

-- CREATE TABLE example_with_defaults (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   org_id text, -- nullable: NULL = global default
--   setting_key text NOT NULL,
--   setting_value text,
--   created_at timestamptz DEFAULT now()
-- );

-- Allow reading global defaults (org_id IS NULL) + own org settings
-- ALTER TABLE example_with_defaults ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY example_with_defaults_select ON example_with_defaults
--   FOR SELECT
--   USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id'));

-- CREATE POLICY example_with_defaults_insert ON example_with_defaults
--   FOR INSERT
--   WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- CREATE POLICY example_with_defaults_update ON example_with_defaults
--   FOR UPDATE
--   USING (org_id = (auth.jwt() ->> 'org_id'))
--   WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- CREATE POLICY example_with_defaults_delete ON example_with_defaults
--   FOR DELETE
--   USING (org_id = (auth.jwt() ->> 'org_id'));


-- Example 4: Table with FK to org-specific parent (no direct org_id)
-- ============================================================

-- CREATE TABLE example_child_records (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   parent_run_id uuid NOT NULL REFERENCES example_org_specific(id),
--   detail text,
--   created_at timestamptz DEFAULT now()
-- );

-- Use EXISTS with JOIN to parent table for org isolation
-- ALTER TABLE example_child_records ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY example_child_records_org_isolation ON example_child_records
--   FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM example_org_specific parent
--       WHERE parent.id = example_child_records.parent_run_id
--       AND parent.org_id = (auth.jwt() ->> 'org_id')
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM example_org_specific parent
--       WHERE parent.id = example_child_records.parent_run_id
--       AND parent.org_id = (auth.jwt() ->> 'org_id')
--     )
--   );


-- ============================================================
-- Post-Migration Verification
-- ============================================================
-- Run these queries after applying the migration:

-- 1. Verify RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('example_org_specific', 'example_global_cache', 'example_with_defaults', 'example_child_records');
-- Expected: All should return rowsecurity = true

-- 2. Verify policies were created
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('example_org_specific', 'example_global_cache', 'example_with_defaults', 'example_child_records')
-- ORDER BY tablename, policyname;

-- 3. Verify no non-admin client access in application code
-- grep -rn "supabase\." app/ lib/ --include="*.ts" | grep -v "supabaseAdmin" | grep "example_org_specific"
-- Expected: No results (all queries should use supabaseAdmin)
