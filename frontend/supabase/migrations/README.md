# Database Migrations

## Security-First Migration Guidelines

**CRITICAL:** Every new table MUST have Row Level Security (RLS) enabled in the same migration that creates it.

### Quick Start

1. **Copy the template:** Use `TEMPLATE_migration.sql` as your starting point
2. **Follow the checklist:** See security checklist below
3. **Verify after applying:** Run verification queries included in template

### Security Checklist

Before submitting any migration that creates a new table:

- [ ] **If table has `org_id` column:** Enable RLS in same migration (see Example 1 in template)
- [ ] **If table is global (no `org_id`):** Add read-only RLS for defense in depth (see Example 2)
- [ ] **If table has nullable `org_id`:** Use special policy to allow reading defaults (see Example 3)
- [ ] **If table has FK to org table:** Use EXISTS subquery pattern (see Example 4)
- [ ] **Verify no non-admin queries:** Search for any direct `supabase` client usage (not `supabaseAdmin`)
- [ ] **Run post-migration verification:** Confirm `rowsecurity = true` and policies exist

### Why This Matters

**June 4, 2026:** Migration 077 fixed 9 tables that shipped without RLS, including `dedup_policies` (migration 076) which had zero protection for just hours after being deployed. This could have resulted in cross-org data exposure.

**Lesson:** RLS is not optional. It must be applied atomically with table creation.

### RLS Policy Patterns

#### Pattern 1: Simple org isolation (most common)
```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {table_name}_org_isolation ON {table_name}
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));
```

#### Pattern 2: Allow reading global defaults
```sql
-- For tables with nullable org_id where NULL = global default
CREATE POLICY {table_name}_select ON {table_name}
  FOR SELECT
  USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY {table_name}_insert ON {table_name}
  FOR INSERT
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY {table_name}_update ON {table_name}
  FOR UPDATE
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY {table_name}_delete ON {table_name}
  FOR DELETE
  USING (org_id = (auth.jwt() ->> 'org_id'));
```

#### Pattern 3: FK-based org isolation
```sql
-- For child tables that inherit org via foreign key
CREATE POLICY {table_name}_org_isolation ON {table_name}
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM {parent_table} p
      WHERE p.id = {table_name}.{parent_fk_column}
      AND p.org_id = (auth.jwt() ->> 'org_id')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM {parent_table} p
      WHERE p.id = {table_name}.{parent_fk_column}
      AND p.org_id = (auth.jwt() ->> 'org_id')
    )
  );
```

#### Pattern 4: Global read-only tables
```sql
-- For shared taxonomy/cache tables
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {table_name}_read_all ON {table_name}
  FOR SELECT
  USING (true);
```

### Verification Queries

After applying any migration, run these queries:

```sql
-- 1. Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = '{your_new_table}';
-- Expected: rowsecurity = true

-- 2. Verify policies exist
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = '{your_new_table}';
-- Expected: At least one policy returned

-- 3. Check for any tables missing RLS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;
-- Expected: Only system/non-sensitive tables
```

### Application Access Pattern

**All application code uses `supabaseAdmin`** (service role key) which bypasses RLS. RLS policies protect against:
1. Direct client-side access (if someone uses non-admin client)
2. Supabase dashboard queries (prevents engineers from accidentally seeing other org's data)
3. Defense in depth (additional security layer)

To verify your code uses admin client:
```bash
grep -rn "from.*{table_name}" app/ lib/ --include="*.ts" -A 3 | grep "supabase\." | grep -v "supabaseAdmin"
```

If any results appear, refactor to use `supabaseAdmin` instead.

### Migration Naming Convention

Format: `YYYYMMDDHHMMSS_NNN_description.sql`

Example: `20260604120000_077_rls_org_isolation.sql`

Where:
- `YYYYMMDDHHMMSS` = Timestamp
- `NNN` = Sequential migration number
- `description` = Snake_case description

### References

- **Template:** `TEMPLATE_migration.sql` - Copy this for new migrations
- **Migration 077:** `20260604120000_077_rls_org_isolation.sql` - Reference implementation
- **Security Checklist:** See `CLAUDE.md` for full checklist

### Common Mistakes to Avoid

1. ❌ Creating table without RLS, planning to "add it later"
   - ✅ Always enable RLS in same migration as table creation

2. ❌ Using `supabase` client instead of `supabaseAdmin`
   - ✅ All app queries should use admin client

3. ❌ Forgetting to test RLS policies work correctly
   - ✅ Run verification queries after every migration

4. ❌ Assuming global tables don't need RLS
   - ✅ Add read-only RLS for defense in depth

5. ❌ Copy-pasting policy names without updating them
   - ✅ Policy names must match actual table names

---

**Last Updated:** June 4, 2026 (Post-Migration 077 Security Audit)
