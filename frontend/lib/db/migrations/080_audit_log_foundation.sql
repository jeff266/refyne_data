-- Migration 080: Audit Log Foundation
-- Tamper-proof audit trail for compliance and debugging
-- Phase 1: Core schema + 5 critical actions

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  user_agent TEXT,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  object_label TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_log_org_created
  ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_actor
  ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_resource
  ON audit_log(object_type, object_id, created_at DESC);
CREATE INDEX idx_audit_log_action
  ON audit_log(org_id, action, created_at DESC);

-- RLS: Read-only for authenticated users
-- Service role (supabaseAdmin) handles inserts
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_org_read ON audit_log
  FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id'));
