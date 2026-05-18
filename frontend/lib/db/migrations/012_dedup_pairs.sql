-- Migration: 012_dedup_pairs.sql
-- Dedup pairs table for tracking duplicate matches

CREATE TABLE IF NOT EXISTS dedup_pairs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text        NOT NULL,

  record_a_id         text        NOT NULL,   -- HubSpot company ID
  record_b_id         text        NOT NULL,   -- HubSpot company ID

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
  suppression_rule_id uuid        REFERENCES dedup_suppression_rules(id),

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
CREATE INDEX dedup_pairs_org_status ON dedup_pairs (org_id, status);
CREATE INDEX dedup_pairs_org_grade ON dedup_pairs (org_id, grade);
CREATE INDEX dedup_pairs_detected ON dedup_pairs (org_id, detected_at DESC);
CREATE INDEX dedup_pairs_confidence ON dedup_pairs (org_id, confidence DESC);

-- Grade calculation rule (enforced in application layer, not DB):
-- A: deterministic_count >= 2 AND name_similarity >= 0.70
-- B: (deterministic_count >= 2 AND name_similarity < 0.70)
--     OR (deterministic_count = 1 AND name_similarity >= 0.70)
-- C: deterministic_count = 1 AND name_similarity < 0.40
-- D: deterministic_count = 0

-- Enable RLS
ALTER TABLE dedup_pairs ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "org_isolation" ON dedup_pairs
  FOR ALL USING (org_id = current_setting('app.org_id', true));
