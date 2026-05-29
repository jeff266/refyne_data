-- Add new survivorship rule types to CHECK constraint
-- Sprint 5: specific_value (priority-based enum matching) and rollup (numeric aggregation)
-- Also add most_recent which was implemented but missing from constraint

-- Drop the old constraint
ALTER TABLE public.dedup_survivorship_rules
DROP CONSTRAINT IF EXISTS dedup_survivorship_rules_rule_type_check;

-- Add new constraint with all 7 rule types
ALTER TABLE public.dedup_survivorship_rules
ADD CONSTRAINT dedup_survivorship_rules_rule_type_check
CHECK (rule_type IN (
  'never_downgrade',
  'prefer_nonempty',
  'tld_disqualifier',
  'source_preference',
  'most_recent',
  'specific_value',
  'rollup'
));

COMMENT ON COLUMN dedup_survivorship_rules.rule_type IS 'never_downgrade = lifecycle funnel protection, prefer_nonempty = fill gaps, tld_disqualifier = confidence penalty, source_preference = trust ranking, most_recent = timestamp-based, specific_value = enum priority, rollup = numeric aggregation';
