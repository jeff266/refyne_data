-- Migration 015b: Organization Events Audit Log
-- Tracks all admin actions for compliance and debugging

CREATE TABLE IF NOT EXISTS org_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  user_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'member.invited',
    'member.removed',
    'member.role_changed',
    'settings.updated',
    'limit.created',
    'limit.updated',
    'limit.deleted',
    'quarantine.approved',
    'quarantine.rejected',
    'agency.offboarded',
    'push.blocked',
    'push.quarantined',
    'push.allowed'
  )),
  resource_type text,
  resource_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS org_events_org_created ON org_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS org_events_user ON org_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS org_events_type ON org_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS org_events_resource ON org_events (resource_type, resource_id);

-- Enable RLS
ALTER TABLE org_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for org isolation
DROP POLICY IF EXISTS "org_isolation" ON org_events;
CREATE POLICY "org_isolation" ON org_events
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Add comment for migration tracking
COMMENT ON TABLE org_events IS 'Migration 015b: Audit log for all org-level actions';
