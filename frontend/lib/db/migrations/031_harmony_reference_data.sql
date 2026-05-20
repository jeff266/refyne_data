-- Migration 031: Harmony Reference Data + Fuzzy Matching
-- Implements three-tier matching: exact → fuzzy (pg_trgm) → phonetic (metaphone)

-- ── Enable PostgreSQL fuzzy matching extensions ──────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ── Core reference data table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS harmony_reference_data (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      text    NOT NULL,
  -- 'industries', 'countries', 'states_provinces',
  -- 'legal_suffixes', 'job_titles', 'phone_formats'
  input_value     text    NOT NULL,
  canonical_value text    NOT NULL,
  language        text    NOT NULL DEFAULT 'universal',
  -- 'universal', 'en', 'es', 'en-GB', 'fr', 'de', 'pt'
  source          text    NOT NULL DEFAULT 'refyne',
  -- 'refyne'    → preset, not deletable
  -- 'user'      → custom, editable
  -- 'community' → shared by other Refyne customers (future)
  fuzzy_eligible  boolean NOT NULL DEFAULT true,
  -- false = exact match only (e.g. ISO codes, phone prefixes)
  -- true  = allow fuzzy/phonetic fallback
  org_id          text,
  -- null  = global preset (available to all orgs)
  -- set   = org-specific custom mapping
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, lower(input_value), COALESCE(org_id, ''))
);

-- Exact match index (fast path)
CREATE INDEX hrd_exact
  ON harmony_reference_data (table_name, lower(input_value))
  WHERE is_active = true;

-- Trigram index (fuzzy path)
CREATE INDEX hrd_trgm
  ON harmony_reference_data
  USING gin (lower(input_value) gin_trgm_ops)
  WHERE is_active = true AND fuzzy_eligible = true;

-- Org + table index
CREATE INDEX hrd_org_table
  ON harmony_reference_data (org_id, table_name)
  WHERE is_active = true;

ALTER TABLE harmony_reference_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preset_and_org"
  ON harmony_reference_data FOR ALL
  USING (
    org_id IS NULL
    OR org_id = current_setting('app.org_id', true)
  );

-- ── Harmony definition updates ────────────────────────────────────
ALTER TABLE harmonies
  ADD COLUMN IF NOT EXISTS transform_type text NOT NULL DEFAULT 'lookup'
    CHECK (transform_type IN ('lookup', 'format', 'custom')),
  ADD COLUMN IF NOT EXISTS reference_table text,
  -- which table_name to JOIN against
  ADD COLUMN IF NOT EXISTS fuzzy_threshold  float NOT NULL DEFAULT 0.80,
  -- minimum trigram similarity to accept as a fuzzy match
  ADD COLUMN IF NOT EXISTS phonetic_enabled boolean NOT NULL DEFAULT false,
  -- enable Tier 3 phonetic matching (slower, lower confidence)
  ADD COLUMN IF NOT EXISTS yaml_content     text;
  -- kept for migration reference only, not used by engine

-- ── Lookup result cache ───────────────────────────────────────────
-- Caches match results so repeated values aren't re-evaluated
CREATE TABLE IF NOT EXISTS harmony_lookup_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          text NOT NULL,
  harmony_id      text NOT NULL,
  input_value     text NOT NULL,
  canonical_value text,
  match_type      text CHECK (match_type IN ('exact','fuzzy','phonetic','none')),
  confidence      int,
  cached_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, harmony_id, lower(input_value))
);

CREATE INDEX hlc_lookup
  ON harmony_lookup_cache (org_id, harmony_id, lower(input_value));

ALTER TABLE harmony_lookup_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON harmony_lookup_cache
  FOR ALL USING (org_id = current_setting('app.org_id', true));
