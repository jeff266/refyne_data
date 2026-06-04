/**
 * Migration 076: Dedup Policies
 *
 * Configurable merge policies for dedup operations.
 * Allows orgs to control merge behavior with field-level rules and exclusion criteria.
 */

-- Dedup policies table: org-specific merge configurations
CREATE TABLE public.dedup_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default Policy',
  is_active BOOLEAN DEFAULT true,

  -- Exclusion rules (block merge if conditions met)
  block_if_different_parent BOOLEAN DEFAULT false,
  block_if_closed_won_deals BOOLEAN DEFAULT false,

  -- Compliance fields (always enforced regardless of other rules)
  compliance_fields JSONB DEFAULT '["hs_email_optout", "hs_email_bounce", "hs_email_hardbounce_reason", "hs_legal_basis"]'::jsonb,

  -- Field merge rules (array of rule objects)
  field_rules JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick org lookup
CREATE INDEX idx_dedup_policies_org_id ON public.dedup_policies(org_id);
CREATE INDEX idx_dedup_policies_active ON public.dedup_policies(org_id, is_active) WHERE is_active = true;

-- Seed default policy for reference (org_id = '__default__')
INSERT INTO public.dedup_policies (org_id, name, field_rules, block_if_different_parent, block_if_closed_won_deals) VALUES
('__default__', 'Default Dedup Policy',
'[
  {
    "field": "lifecyclestage",
    "rule": "keep_most_advanced",
    "config": {
      "order": ["lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer"]
    }
  },
  {
    "field": "*",
    "rule": "fill_empty",
    "config": {}
  }
]'::jsonb,
false,
false);

-- Add comment
COMMENT ON TABLE public.dedup_policies IS 'Configurable merge policies for dedup operations. Controls field-level merge behavior and exclusion rules.';
