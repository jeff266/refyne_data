-- Migration 032: Harmony Lookup Functions
-- Three-tier matching functions: exact → fuzzy → phonetic

-- ── Single value lookup ───────────────────────────────────────────
-- Returns the best match with match_type and confidence
CREATE OR REPLACE FUNCTION lookup_harmony_value(
  p_table_name        text,
  p_input_value       text,
  p_org_id            text      DEFAULT NULL,
  p_fuzzy_threshold   float     DEFAULT 0.80,
  p_phonetic_enabled  boolean   DEFAULT false
)
RETURNS TABLE (
  canonical_value text,
  match_type      text,
  confidence      int
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_normalized text := lower(trim(p_input_value));
BEGIN
  -- ── Tier 1: Exact match ────────────────────────────────────────
  RETURN QUERY
    SELECT hrd.canonical_value, 'exact'::text, 100::int
    FROM harmony_reference_data hrd
    WHERE hrd.table_name = p_table_name
      AND lower(hrd.input_value) = v_normalized
      AND hrd.is_active = true
      AND (hrd.org_id IS NULL OR hrd.org_id = p_org_id)
    ORDER BY hrd.org_id NULLS LAST
    -- org-specific mappings take priority over global presets
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- ── Tier 2: Fuzzy trigram match ────────────────────────────────
  RETURN QUERY
    SELECT
      hrd.canonical_value,
      'fuzzy'::text,
      (similarity(lower(hrd.input_value), v_normalized) * 100)::int
    FROM harmony_reference_data hrd
    WHERE hrd.table_name = p_table_name
      AND hrd.fuzzy_eligible = true
      AND hrd.is_active = true
      AND (hrd.org_id IS NULL OR hrd.org_id = p_org_id)
      AND similarity(lower(hrd.input_value), v_normalized)
          >= p_fuzzy_threshold
    ORDER BY similarity(lower(hrd.input_value), v_normalized) DESC
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- ── Tier 3: Phonetic match (optional) ─────────────────────────
  IF p_phonetic_enabled THEN
    RETURN QUERY
      SELECT
        hrd.canonical_value,
        'phonetic'::text,
        65::int
      FROM harmony_reference_data hrd
      WHERE hrd.table_name = p_table_name
        AND hrd.fuzzy_eligible = true
        AND hrd.is_active = true
        AND (hrd.org_id IS NULL OR hrd.org_id = p_org_id)
        AND dmetaphone(hrd.input_value) = dmetaphone(p_input_value)
        AND hrd.input_value != p_input_value
      LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- ── No match ───────────────────────────────────────────────────
  RETURN QUERY SELECT NULL::text, 'none'::text, 0::int;

END;
$$;

-- ── Batch lookup (bulk normalization) ─────────────────────────────
-- Called once per harmony per batch — far more efficient than
-- calling lookup_harmony_value per record
CREATE OR REPLACE FUNCTION batch_lookup_harmony(
  p_table_name       text,
  p_input_values     text[],
  p_org_id           text    DEFAULT NULL,
  p_fuzzy_threshold  float   DEFAULT 0.80,
  p_phonetic_enabled boolean DEFAULT false
)
RETURNS TABLE (
  input_value     text,
  canonical_value text,
  match_type      text,
  confidence      int
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (unnested.val)
    unnested.val,
    result.canonical_value,
    result.match_type,
    result.confidence
  FROM unnest(p_input_values) AS unnested(val)
  CROSS JOIN LATERAL (
    SELECT * FROM lookup_harmony_value(
      p_table_name,
      unnested.val,
      p_org_id,
      p_fuzzy_threshold,
      p_phonetic_enabled
    )
    LIMIT 1
  ) result;
$$;
