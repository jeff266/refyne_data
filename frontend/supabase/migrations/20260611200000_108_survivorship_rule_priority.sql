-- Migration 108: Add priority column to dedup_survivorship_rules
-- Allows users to define evaluation order for their custom rules

-- Add priority column (nullable for backward compatibility)
ALTER TABLE public.dedup_survivorship_rules
ADD COLUMN priority INTEGER;

-- Default rules (__default__ org_id) get priority 1000, 2000, 3000
-- This ensures they evaluate after user rules (which start from 1)
UPDATE public.dedup_survivorship_rules
SET priority = CASE
  WHEN field_key = 'lifecyclestage' AND rule_type = 'never_downgrade' THEN 1000
  WHEN field_key = '*' AND rule_type = 'prefer_nonempty' THEN 2000
  WHEN field_key = 'domain' AND rule_type = 'tld_disqualifier' THEN 3000
  ELSE priority
END
WHERE org_id = '__default__';

-- Create index for efficient ordering
CREATE INDEX idx_survivorship_rules_org_priority
ON dedup_survivorship_rules(org_id, priority);

COMMENT ON COLUMN dedup_survivorship_rules.priority IS 'Evaluation order: lower numbers run first. Default rules use 1000+. Null = legacy rules before this migration.';
