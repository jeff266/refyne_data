-- Migration: 011_dedup_config.sql
-- Dedup Configurator tables

CREATE TABLE dedup_config (
  org_id                   text PRIMARY KEY,

  -- Confidence bands
  auto_merge_grade         text        NOT NULL DEFAULT 'A'
                           CHECK (auto_merge_grade IN ('disabled','A','AB')),
  auto_merge_threshold     int         NOT NULL DEFAULT 90
                           CHECK (auto_merge_threshold BETWEEN 50 AND 100),
  review_floor_threshold   int         NOT NULL DEFAULT 70
                           CHECK (review_floor_threshold BETWEEN 0 AND 89),

  -- Signal weights (probabilistic tiers only)
  signal_phone_weight      numeric(4,2) NOT NULL DEFAULT 0.50
                           CHECK (signal_phone_weight BETWEEN 0 AND 1),
  signal_address_weight    numeric(4,2) NOT NULL DEFAULT 0.30
                           CHECK (signal_address_weight BETWEEN 0 AND 1),
  signal_name_weight       numeric(4,2) NOT NULL DEFAULT 0.20
                           CHECK (signal_name_weight BETWEEN 0 AND 1),

  -- Name matching
  name_levenshtein_floor   numeric(4,2) NOT NULL DEFAULT 0.85
                           CHECK (name_levenshtein_floor BETWEEN 0 AND 1),
  name_divergence_guard    boolean     NOT NULL DEFAULT true,
  name_divergence_floor    numeric(4,2) NOT NULL DEFAULT 0.40
                           CHECK (name_divergence_floor BETWEEN 0 AND 1),
  stopwords                text[]      NOT NULL DEFAULT ARRAY[
                             'Inc','LLC','Corp','Ltd','Group','Holdings',
                             'Partners','Services','Solutions',
                             'Technologies','Systems','Co','Company'
                           ],

  -- Parent-child behavior
  parent_direct_action     text        NOT NULL DEFAULT 'block'
                           CHECK (parent_direct_action IN ('block','review')),
  parent_same_action       text        NOT NULL DEFAULT 'review'
                           CHECK (parent_same_action IN ('block','review','score')),
  parent_one_multiplier    numeric(4,2) NOT NULL DEFAULT 0.75
                           CHECK (parent_one_multiplier BETWEEN 0 AND 1),
  parent_different_score   numeric(4,2) NOT NULL DEFAULT 0.0
                           CHECK (parent_different_score BETWEEN 0 AND 1),

  -- Survivorship
  survivorship_default     text        NOT NULL DEFAULT 'most_associated'
                           CHECK (survivorship_default IN (
                             'most_associated','oldest',
                             'most_complete','highest_score'
                           )),
  bulk_survivorship        text        NOT NULL DEFAULT 'most_associated'
                           CHECK (bulk_survivorship IN (
                             'most_associated','oldest',
                             'most_complete','highest_score'
                           )),

  -- Core display fields (drives accordion without expand)
  core_display_fields      text[]      NOT NULL DEFAULT ARRAY[
                             'name','domain','industry',
                             'phone','employees','city','website'
                           ],

  -- Post-merge
  archive_losing_record    boolean     NOT NULL DEFAULT true,
  transfer_associations    boolean     NOT NULL DEFAULT true,
  rollback_window_hours    int         NOT NULL DEFAULT 48,
  notify_on_auto_merge     boolean     NOT NULL DEFAULT true,

  -- Scan
  scan_trigger             text        NOT NULL DEFAULT 'on_sync'
                           CHECK (scan_trigger IN (
                             'on_sync','hourly','daily','manual'
                           )),

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dedup_suppression_rules (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text        NOT NULL,
  name                text        NOT NULL,
  priority            int         NOT NULL,
  enabled             boolean     NOT NULL DEFAULT true,
  action              text        NOT NULL
                      CHECK (action IN ('block','review','require_approval')),
  approver_user_id    text,       -- required when action = 'require_approval'
  condition_operator  text        NOT NULL DEFAULT 'AND'
                      CHECK (condition_operator IN ('AND','OR')),
  conditions          jsonb       NOT NULL DEFAULT '[]',
  ui_note             text,
  suppressed_count    int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, priority)
);

-- Condition object shape (stored in conditions jsonb array):
-- {
--   field:    string,          canonical field name or HubSpot property key
--   operator: 'is_blank'
--           | 'is_not_blank'
--           | 'equals'
--           | 'not_equals'
--           | 'differs_between'
--           | 'matches_between'
--           | 'contains',
--   value:    string | null,   only for equals / not_equals / contains
--   scope:    'record_a' | 'record_b' | 'both' | 'either'
-- }

-- Enable RLS
ALTER TABLE dedup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dedup_suppression_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "org_isolation" ON dedup_config
  FOR ALL USING (org_id = current_setting('app.org_id', true));

CREATE POLICY "org_isolation" ON dedup_suppression_rules
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Index for suppression rules lookup
CREATE INDEX dedup_suppression_rules_org_priority
  ON dedup_suppression_rules (org_id, priority);
