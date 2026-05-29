/**
 * Migration 040: Enrichment Field Sources
 *
 * Tracks which data source (GraphIQ, Apollo, ZoomInfo, etc.) wrote each field value.
 * Used by source_preference survivorship rule to prefer values from more trusted sources.
 *
 * One row per (org_id, hubspot_company_id, field_key) combination.
 * Updated whenever enrichment applies a value to a HubSpot field.
 */

-- Create enrichment_field_sources table
CREATE TABLE IF NOT EXISTS public.enrichment_field_sources (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  hubspot_company_id  text NOT NULL,
  field_key           text NOT NULL,
  source              text NOT NULL,  -- 'graphiq', 'apollo', 'zoominfo', etc.
  written_at          timestamptz DEFAULT now(),
  CONSTRAINT unique_field_source UNIQUE(org_id, hubspot_company_id, field_key)
);

-- Index for fast lookups when evaluating survivorship rules
CREATE INDEX IF NOT EXISTS idx_enrichment_field_sources_lookup
  ON public.enrichment_field_sources(org_id, hubspot_company_id);

-- Seed default source preference rule (only if it doesn't exist)
INSERT INTO public.dedup_survivorship_rules
  (org_id, field_key, rule_type, rule_config, is_active)
SELECT
  '__default__', '*', 'source_preference', '{
    "source_rank": [
      "graphiq",
      "apollo",
      "zoominfo",
      "cognism",
      "refyne_search",
      "clearbit",
      "user_entered",
      "hubspot_import",
      "unknown"
    ]
  }'::jsonb, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.dedup_survivorship_rules
  WHERE org_id = '__default__' AND field_key = '*' AND rule_type = 'source_preference'
);

-- Add comment for documentation
COMMENT ON TABLE public.enrichment_field_sources IS
  'Tracks which data source wrote each field value for source_preference survivorship rule';
