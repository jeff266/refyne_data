-- Migration 010: Compliance Dashboard Tables
-- Tracks normalized record status for compliance scoring and insights.

-- ─────────────────────────────────────────────────────────────
-- Table: normalized_records
-- ─────────────────────────────────────────────────────────────
-- Tracks the normalization status of each field on each record.
-- Status values:
--   'compliant'   - harmony_version matches current published version
--   'stale'       - harmony_version is older than current published version
--   'unprocessed' - harmony_id is null, field never normalized

CREATE TABLE normalized_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           text NOT NULL,
  record_id        text NOT NULL,
  record_type      text NOT NULL,         -- 'company' | 'contact'
  source           text,                  -- provider id that sourced this value
  field            text NOT NULL,         -- canonical field name e.g. 'industry'
  raw_value        text,                  -- value before normalization
  normalized_value text,                  -- value after normalization
  harmony_id       text,                  -- Harmony that processed this field
  harmony_version  text,                  -- version of that Harmony
  status           text NOT NULL,         -- 'compliant' | 'stale' | 'unprocessed'
  normalized_at    timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (org_id, record_id, field)
);

-- Index for score queries: count by status
CREATE INDEX idx_normalized_records_org_status
  ON normalized_records (org_id, status);

-- Index for per-Harmony breakdown
CREATE INDEX idx_normalized_records_org_harmony_status
  ON normalized_records (org_id, harmony_id, status);

-- Index for per-field breakdown
CREATE INDEX idx_normalized_records_org_type_field
  ON normalized_records (org_id, record_type, field);

-- Index for drill-down queries by record
CREATE INDEX idx_normalized_records_org_record
  ON normalized_records (org_id, record_id);

COMMENT ON TABLE normalized_records IS 'Tracks normalization status of each field per record for compliance scoring';
COMMENT ON COLUMN normalized_records.status IS 'compliant = current version, stale = outdated version, unprocessed = never normalized';

-- ─────────────────────────────────────────────────────────────
-- Table: compliance_score_history
-- ─────────────────────────────────────────────────────────────
-- Stores point-in-time compliance scores for trend analysis.

CREATE TABLE compliance_score_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text NOT NULL,
  score       numeric NOT NULL,
  compliant   int NOT NULL,
  stale       int NOT NULL,
  unprocessed int NOT NULL,
  total       int NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for trend queries (most recent first)
CREATE INDEX idx_compliance_score_history_org_time
  ON compliance_score_history (org_id, computed_at DESC);

COMMENT ON TABLE compliance_score_history IS 'Historical compliance scores for trend analysis';

-- ─────────────────────────────────────────────────────────────
-- Table: compliance_alerts
-- ─────────────────────────────────────────────────────────────
-- Alert configuration per org. One row per org.

CREATE TABLE compliance_alerts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  text NOT NULL UNIQUE,
  score_threshold         numeric,          -- alert when score drops below
  harmony_threshold       numeric,          -- alert when any Harmony drops below
  unprocessed_threshold   int,              -- alert when unprocessed exceeds
  notify_email            boolean DEFAULT true,
  notify_slack_webhook    text,             -- Slack webhook URL if configured
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

COMMENT ON TABLE compliance_alerts IS 'Alert thresholds and notification settings per organization';

-- ─────────────────────────────────────────────────────────────
-- Table: compliance_insights
-- ─────────────────────────────────────────────────────────────
-- Auto-generated insights from stale/unprocessed patterns.

CREATE TABLE compliance_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        text NOT NULL,
  harmony_id    text,                     -- Harmony this insight relates to
  field         text,                     -- Field this insight relates to
  insight_type  text NOT NULL,            -- 'pattern_gap' | 'new_source'
  message       text NOT NULL,            -- Human-readable insight message
  record_count  int NOT NULL,             -- Number of records affected
  sample_values jsonb,                    -- Sample of raw values that triggered this
  created_at    timestamptz DEFAULT now(),
  dismissed_at  timestamptz               -- When user dismissed this insight
);

-- Index for fetching active insights
CREATE INDEX idx_compliance_insights_org_active
  ON compliance_insights (org_id, created_at DESC)
  WHERE dismissed_at IS NULL;

COMMENT ON TABLE compliance_insights IS 'Auto-generated insights about normalization gaps';
COMMENT ON COLUMN compliance_insights.insight_type IS 'pattern_gap = unmatched pattern, new_source = provider with 0% match rate';
