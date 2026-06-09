-- Migration: 098_fix_oauth_states_rls.sql
-- Fix RLS policy on hubspot_oauth_states to use modern auth.jwt() pattern
-- Old policy used current_setting() which doesn't work with Clerk + Supabase

-- Drop old policy
DROP POLICY IF EXISTS "org_isolation" ON hubspot_oauth_states;

-- Create modern RLS policy with proper WITH CHECK clause
CREATE POLICY "hubspot_oauth_states_org_isolation" ON hubspot_oauth_states
  FOR ALL
  USING (
    -- Allow service role to bypass (for OAuth callback)
    auth.jwt() ->> 'role' = 'service_role'
    OR
    -- Allow org members to access their own org's states
    org_id = (auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    -- Allow service role to bypass (for OAuth callback)
    auth.jwt() ->> 'role' = 'service_role'
    OR
    -- Allow org members to insert their own org's states
    org_id = (auth.jwt() ->> 'org_id')
  );

COMMENT ON POLICY "hubspot_oauth_states_org_isolation" ON hubspot_oauth_states
  IS 'Org isolation for OAuth states. Service role can access all (for callback). Users can only access their own org.';
