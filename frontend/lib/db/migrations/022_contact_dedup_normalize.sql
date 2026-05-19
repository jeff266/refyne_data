-- Migration: 022_contact_dedup_normalize.sql
-- Contact dedup and normalize feature

-- ══════════════════════════════════════════════════════════════
-- Part 1: Extend normalization tables with object_type
-- ══════════════════════════════════════════════════════════════

-- Add object_type column to normalization_runs
ALTER TABLE normalization_runs
  ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT 'company'
    CHECK (object_type IN ('company', 'contact'));

-- Add object_type column to normalization_changes
ALTER TABLE normalization_changes
  ADD COLUMN IF NOT EXISTS object_type text NOT NULL DEFAULT 'company'
    CHECK (object_type IN ('company', 'contact'));

-- Rename hubspot_company_id to hubspot_record_id (backward compatible via view)
ALTER TABLE normalization_changes
  RENAME COLUMN hubspot_company_id TO hubspot_record_id;

-- Create index on object_type for faster filtering
CREATE INDEX IF NOT EXISTS norm_changes_object_type
  ON normalization_changes (org_id, object_type);

-- ══════════════════════════════════════════════════════════════
-- Part 2: Contact dedup pairs table
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contact_dedup_pairs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text        NOT NULL,

  record_a_id         text        NOT NULL,   -- HubSpot contact ID
  record_b_id         text        NOT NULL,   -- HubSpot contact ID

  confidence          numeric(5,2) NOT NULL   -- 0–100
                      CHECK (confidence BETWEEN 0 AND 100),
  grade               text        NOT NULL
                      CHECK (grade IN ('A','B','C','D')),
  name_similarity     numeric(4,2)            -- 0–1, nullable if name unavailable
                      CHECK (name_similarity IS NULL OR name_similarity BETWEEN 0 AND 1),

  signals_fired       jsonb       NOT NULL DEFAULT '[]',
  -- Signal object shape:
  -- { tier: int, type: string, deterministic: boolean, score: float }

  status              text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','approved','rejected',
                        'suppressed','merged','reversed'
                      )),
  suppression_rule_id uuid,

  -- Set on merge
  surviving_record_id text,
  merged_at           timestamptz,
  merged_by           text,       -- clerk user_id or 'auto'
  field_selections    jsonb,      -- { fieldName: 'record_a' | 'record_b' }

  detected_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, record_a_id, record_b_id)
);

-- Indexes for common queries
CREATE INDEX contact_dedup_pairs_org_status ON contact_dedup_pairs (org_id, status);
CREATE INDEX contact_dedup_pairs_org_grade ON contact_dedup_pairs (org_id, grade);
CREATE INDEX contact_dedup_pairs_detected ON contact_dedup_pairs (org_id, detected_at DESC);
CREATE INDEX contact_dedup_pairs_confidence ON contact_dedup_pairs (org_id, confidence DESC);

-- Grade calculation rule (enforced in application layer):
-- A: email match (automatic 95 confidence) OR (deterministic >= 2 AND name_similarity >= 0.70)
-- B: deterministic >= 1 AND name_similarity >= 0.70
-- C: deterministic >= 1 AND name_similarity < 0.40
-- D: deterministic = 0

-- Enable RLS
ALTER TABLE contact_dedup_pairs ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "org_isolation" ON contact_dedup_pairs
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- ══════════════════════════════════════════════════════════════
-- Part 3: Contact normalization settings
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contact_normalization_settings (
  org_id              text        PRIMARY KEY,

  -- Harmonies to apply
  enabled_harmonies   jsonb       NOT NULL DEFAULT '[]',
  -- Array of harmony IDs: ["name_case", "phone_e164", "title_standard", "email_lower", "location"]

  -- Scope
  scope_type          text        NOT NULL DEFAULT 'all'
                      CHECK (scope_type IN ('all', 'list', 'filter')),
  scope_list_id       text,       -- HubSpot list ID if scope_type = 'list'
  scope_filters       jsonb,      -- Filter criteria if scope_type = 'filter'

  -- Preview settings
  preview_limit       int         NOT NULL DEFAULT 100
                      CHECK (preview_limit BETWEEN 1 AND 1000),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE contact_normalization_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "org_isolation" ON contact_normalization_settings
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- ══════════════════════════════════════════════════════════════
-- Part 4: Contact dedup runs
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contact_dedup_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text        NOT NULL,
  connection_id       uuid        NOT NULL REFERENCES hubspot_connections(id),
  initiated_by        text        NOT NULL,   -- Clerk user_id or 'system'

  status              text        NOT NULL DEFAULT 'running'
                      CHECK (status IN (
                        'running','completed','failed'
                      )),

  contacts_scanned    int         NOT NULL DEFAULT 0,
  pairs_detected      int         NOT NULL DEFAULT 0,
  pairs_grade_a       int         NOT NULL DEFAULT 0,
  pairs_grade_b       int         NOT NULL DEFAULT 0,
  pairs_grade_c       int         NOT NULL DEFAULT 0,
  pairs_grade_d       int         NOT NULL DEFAULT 0,

  error_message       text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

-- Index on org and date
CREATE INDEX contact_dedup_runs_org_date
  ON contact_dedup_runs (org_id, started_at DESC);

-- Enable RLS
ALTER TABLE contact_dedup_runs ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "org_isolation" ON contact_dedup_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));
