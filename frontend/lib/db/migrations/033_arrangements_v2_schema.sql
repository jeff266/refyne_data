-- Migration: 033_arrangements_v2_schema.sql
-- Adds Arrangements v2 - Field-level waterfall builder, calibration, numeric aggregation

-- ============================================================
-- 1. Extend arrangements table with field_configs
-- ============================================================

-- Add field_configs column (field-first waterfall)
ALTER TABLE arrangements
ADD COLUMN field_configs jsonb;

-- field_configs structure:
-- [
--   {
--     "field_key": "industry",
--     "field_type": "categorical",
--     "aggregation_strategy": "waterfall",
--     "apply_harmony": true,
--     "harmony_id": "uuid-of-industry-harmony",
--     "steps": [
--       { "order": 1, "provider": "zoominfo", "policy": "fill_empty" },
--       { "order": 2, "provider": "apollo", "policy": "fill_empty" }
--     ]
--   }
-- ]

-- Keep enrichment_steps for backwards compatibility during migration
-- After all existing arrangements are migrated to field_configs, we can drop it

COMMENT ON COLUMN arrangements.field_configs IS 'V2: Field-first waterfall config with per-field provider chains';
COMMENT ON COLUMN arrangements.enrichment_steps IS 'V1: Deprecated - use field_configs instead';


-- ============================================================
-- 2. Provider calibration scores
-- ============================================================

CREATE TABLE provider_calibration_scores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  field_key           text NOT NULL,
  provider            text NOT NULL,
  agree_count         integer NOT NULL DEFAULT 0,
  disagree_count      integer NOT NULL DEFAULT 0,

  -- Computed confidence score (agree / total)
  score               numeric GENERATED ALWAYS AS (
                        CASE WHEN (agree_count + disagree_count) = 0 THEN NULL
                        ELSE agree_count::numeric / (agree_count + disagree_count)
                        END
                      ) STORED,

  last_calibrated_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, field_key, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS provider_calibration_scores_org_idx
  ON provider_calibration_scores(org_id);
CREATE INDEX IF NOT EXISTS provider_calibration_scores_field_idx
  ON provider_calibration_scores(org_id, field_key);
CREATE INDEX IF NOT EXISTS provider_calibration_scores_score_idx
  ON provider_calibration_scores(org_id, field_key, score DESC NULLS LAST);

-- RLS
ALTER TABLE provider_calibration_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON provider_calibration_scores
  FOR ALL USING (org_id = current_setting('app.org_id', true));


-- ============================================================
-- 3. Calibration sessions
-- ============================================================

CREATE TABLE calibration_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  field_key           text NOT NULL,
  field_type          text NOT NULL CHECK (field_type IN ('categorical', 'numeric', 'url', 'text', 'boolean')),

  -- Which providers were tested
  providers           text[] NOT NULL,

  -- Sample configuration
  sample_size         integer NOT NULL DEFAULT 10,

  -- Cost tracking
  credits_used        integer,

  -- Status
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Results storage
  -- Structure: [
  --   {
  --     "hubspot_company_id": "123",
  --     "company_name": "Acme Corp",
  --     "provider_values": { "apollo": "Computer Software", "zoominfo": "SaaS" },
  --     "harmony_normalized": { "apollo": "Software", "zoominfo": "Software" },
  --     "admin_vote": "apollo"
  --   }
  -- ]
  results             jsonb,

  -- Error tracking
  error_message       text,

  -- Audit
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS calibration_sessions_org_idx
  ON calibration_sessions(org_id);
CREATE INDEX IF NOT EXISTS calibration_sessions_field_idx
  ON calibration_sessions(org_id, field_key);
CREATE INDEX IF NOT EXISTS calibration_sessions_created_at_idx
  ON calibration_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS calibration_sessions_status_idx
  ON calibration_sessions(status) WHERE status IN ('pending', 'running');

-- RLS
ALTER TABLE calibration_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON calibration_sessions
  FOR ALL USING (org_id = current_setting('app.org_id', true));


-- ============================================================
-- 4. Arrangement settings (org-level preferences)
-- ============================================================

CREATE TABLE arrangement_settings (
  org_id                        text PRIMARY KEY,

  -- Numeric aggregation defaults (set during onboarding)
  numeric_default_strategy      text NOT NULL DEFAULT 'waterfall'
                                CHECK (numeric_default_strategy IN (
                                  'waterfall',      -- First provider that returns a value
                                  'max',            -- Highest value across all providers
                                  'min',            -- Lowest value across all providers
                                  'average',        -- Arithmetic mean
                                  'cluster_average' -- Mean after dropping outliers (1 SD from median)
                                )),

  -- Per-field numeric strategy overrides
  -- { "employee_count": "cluster_average", "revenue": "max" }
  field_numeric_strategies      jsonb DEFAULT '{}'::jsonb,

  -- Calibration preferences
  calibration_auto_suggest      boolean NOT NULL DEFAULT true, -- Show calibration-based recommendations

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE arrangement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON arrangement_settings
  FOR ALL USING (org_id = current_setting('app.org_id', true));


-- ============================================================
-- 5. Extend onboarding_progress with arrangements flag
-- ============================================================

ALTER TABLE onboarding_progress
ADD COLUMN arrangements_onboarding_complete boolean NOT NULL DEFAULT false,
ADD COLUMN arrangements_onboarding_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN onboarding_progress.arrangements_onboarding_complete
  IS 'True after user completes arrangements onboarding (calibration or skip)';
COMMENT ON COLUMN onboarding_progress.arrangements_onboarding_skipped
  IS 'True if user skipped calibration during onboarding';


-- ============================================================
-- 6. Helper view: Provider confidence rankings
-- ============================================================

-- View that ranks providers by confidence score per field
CREATE OR REPLACE VIEW provider_confidence_rankings AS
SELECT
  org_id,
  field_key,
  provider,
  score,
  agree_count,
  disagree_count,
  last_calibrated_at,
  ROW_NUMBER() OVER (
    PARTITION BY org_id, field_key
    ORDER BY score DESC NULLS LAST, agree_count DESC
  ) AS confidence_rank
FROM provider_calibration_scores
WHERE (agree_count + disagree_count) > 0;

COMMENT ON VIEW provider_confidence_rankings
  IS 'Ranks providers by calibrated confidence score per org and field';
