-- Migration 092: Provider Requests
-- Allows customers to request new provider integrations

CREATE TABLE IF NOT EXISTS public.provider_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  requested_by TEXT NOT NULL, -- user_id
  provider_name TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shipped', 'declined')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: org can only read/write their own requests
ALTER TABLE provider_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_requests_org_isolation ON provider_requests
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Index for performance
CREATE INDEX IF NOT EXISTS provider_requests_org_id_idx ON provider_requests(org_id);
CREATE INDEX IF NOT EXISTS provider_requests_status_idx ON provider_requests(status);
