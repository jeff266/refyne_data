-- Dedup Survivorship Rules
-- Engine for automatic field-level winner selection during merge operations
-- Prevents lifecycle stage downgrades, fills gaps, flags TLD mismatches

CREATE TABLE public.dedup_survivorship_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          text NOT NULL,
  field_key       text NOT NULL,
  rule_type       text NOT NULL
                  CHECK (rule_type IN (
                    'never_downgrade',
                    'prefer_nonempty',
                    'tld_disqualifier',
                    'source_preference'
                  )),
  rule_config     jsonb NOT NULL DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_survivorship_rules_org
ON dedup_survivorship_rules(org_id);

COMMENT ON TABLE dedup_survivorship_rules IS 'Defines automatic field-level merge rules to prevent data quality regressions';
COMMENT ON COLUMN dedup_survivorship_rules.org_id IS '__default__ for global rules, org_id for overrides';
COMMENT ON COLUMN dedup_survivorship_rules.rule_type IS 'never_downgrade = lifecycle funnel protection, prefer_nonempty = fill gaps, tld_disqualifier = confidence penalty';

-- Seed default rules for all orgs
-- These apply globally until org-specific rules override them
INSERT INTO dedup_survivorship_rules
  (org_id, field_key, rule_type, rule_config)
VALUES
  ('__default__', 'lifecyclestage', 'never_downgrade', '{
    "order": ["opportunity", "salesqualifiedlead", "marketingqualifiedlead", "lead", "subscriber", "other"]
  }'),
  ('__default__', '*', 'prefer_nonempty', '{}'),
  ('__default__', 'domain', 'tld_disqualifier', '{
    "tld_pairs_to_flag": [
      [".com", ".com.au"],
      [".com", ".co.uk"],
      [".com", ".co.nz"],
      [".com", ".ca"],
      [".com", ".ie"]
    ],
    "confidence_penalty": 20
  }');
