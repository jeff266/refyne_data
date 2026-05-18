-- Migration: 013_hubspot_oauth.sql
-- HubSpot OAuth integration for marketplace compliance

-- Add OAuth columns to hubspot_connections
ALTER TABLE hubspot_connections
  ADD COLUMN hub_id              text,
  ADD COLUMN access_token        text,
  ADD COLUMN refresh_token       text,
  ADD COLUMN token_expires_at    timestamptz,
  ADD COLUMN oauth_scopes        text[],
  ADD COLUMN connection_status   text NOT NULL DEFAULT 'active'
    CHECK (connection_status IN ('active','expired','disconnected','error')),
  ADD COLUMN disconnected_at     timestamptz,
  ADD COLUMN last_active_at      timestamptz;

-- DO NOT DROP private_app_token — keep for rollback safety
COMMENT ON COLUMN hubspot_connections.private_app_token
  IS 'DEPRECATED as of migration 013. Use access_token + refresh_token for OAuth connections.';

-- CSRF protection for OAuth state
CREATE TABLE hubspot_oauth_states (
  state          text PRIMARY KEY,
  org_id         text NOT NULL,
  created_by     text NOT NULL,  -- clerk user_id
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used           boolean NOT NULL DEFAULT false
);

CREATE INDEX oauth_states_expires_at ON hubspot_oauth_states (expires_at);
CREATE INDEX oauth_states_org_id ON hubspot_oauth_states (org_id);

-- RLS for oauth_states
ALTER TABLE hubspot_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON hubspot_oauth_states
  FOR ALL USING (org_id = current_setting('app.org_id', true));
