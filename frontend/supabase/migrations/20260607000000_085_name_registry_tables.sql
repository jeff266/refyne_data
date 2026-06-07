-- Global + org-specific name registry
CREATE TABLE public.name_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  org_id TEXT, -- null = global (Refyne-maintained)
  registry_type TEXT NOT NULL, -- 'company' | 'contact_first' | 'contact_last' | 'contact_token'

  -- The entry
  input_token TEXT NOT NULL,    -- what we might see: "ibm", "mcdonald", "leann"
  canonical_form TEXT NOT NULL, -- what to output: "IBM", "McDonald", "LeAnn"

  -- Metadata
  source TEXT NOT NULL, -- 'seed' | 'admin_correction' | 'hubspot_edit' | 'ai_suggestion' | 'manual'
  confidence NUMERIC(3,2) DEFAULT 1.00, -- 1.00 for manual/seed, lower for AI suggestions
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'pending_review' | 'rejected'

  -- Auto-learn tracking
  occurrence_count INTEGER DEFAULT 1, -- how many times this token was seen
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT, -- user_id who approved/rejected
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Global entries: unique on type + token
  -- Org entries: unique on org_id + type + token
  UNIQUE NULLS NOT DISTINCT (org_id, registry_type, input_token)
);

-- Lookup performance
CREATE INDEX idx_name_registry_lookup
  ON name_registry(registry_type, input_token, status)
  WHERE status = 'active';

CREATE INDEX idx_name_registry_org
  ON name_registry(org_id, registry_type)
  WHERE status = 'active';

CREATE INDEX idx_name_registry_pending
  ON name_registry(org_id, status)
  WHERE status = 'pending_review';

-- RLS
ALTER TABLE name_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY name_registry_read ON name_registry
  FOR SELECT USING (
    org_id IS NULL OR -- global entries readable by all
    org_id = (auth.jwt() ->> 'org_id')
  );

CREATE POLICY name_registry_write ON name_registry
  FOR ALL USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Pending review queue tracking
CREATE TABLE public.name_registry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  registry_type TEXT NOT NULL,
  input_token TEXT NOT NULL,
  suggested_canonical TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'hubspot_edit' | 'low_confidence' | 'admin_correction'
  trigger_context JSONB, -- record_id, field, original_value, etc.
  status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'auto_approved'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX idx_name_registry_queue_org
  ON name_registry_queue(org_id, status)
  WHERE status = 'pending';

-- RLS for queue
ALTER TABLE name_registry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY name_registry_queue_org_isolation ON name_registry_queue
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));
