-- Migration 060: Org-specific name exceptions for smart title case
-- Stores company names that should bypass title case normalization

CREATE TABLE public.normalize_name_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  exact_value TEXT NOT NULL,
  reason      TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, exact_value)
);

CREATE INDEX idx_normalize_name_exceptions_org
ON normalize_name_exceptions(org_id);

COMMENT ON TABLE normalize_name_exceptions IS 'Org-specific exceptions for company name normalization - stores exact values that should bypass title case rules';
COMMENT ON COLUMN normalize_name_exceptions.exact_value IS 'Exact company name to preserve (case-sensitive)';
COMMENT ON COLUMN normalize_name_exceptions.reason IS 'Optional reason for exception (e.g., "All-caps brand", "Legal requirement")';
