-- Migration 104: Admin Audit Log
-- Tracks all admin actions on workspace billing/configuration

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id TEXT NOT NULL,
  target_org_id TEXT NOT NULL,
  action TEXT NOT NULL,
  -- Actions: 'change_plan', 'extend_trial', 'reset_credits',
  --          'add_credits', 'toggle_feature_flag', 'change_status'
  before_state JSONB,
  after_state JSONB,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_admin_audit_log_org
  ON public.admin_audit_log(target_org_id, created_at DESC);

CREATE INDEX idx_admin_audit_log_admin
  ON public.admin_audit_log(admin_user_id, created_at DESC);

-- No RLS - service role only
-- Staff access via service client with isRefyneStaff check in application code

COMMENT ON TABLE public.admin_audit_log IS 'Audit trail of all admin changes to workspace billing and configuration';
COMMENT ON COLUMN public.admin_audit_log.action IS 'Type of action: change_plan, extend_trial, reset_credits, add_credits, toggle_feature_flag, change_status';
COMMENT ON COLUMN public.admin_audit_log.before_state IS 'JSON snapshot of org_billing row before change';
COMMENT ON COLUMN public.admin_audit_log.after_state IS 'JSON snapshot of fields that changed';
COMMENT ON COLUMN public.admin_audit_log.note IS 'Optional note from admin explaining the change';
