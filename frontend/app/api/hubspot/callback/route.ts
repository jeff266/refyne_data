import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { upsertSchemaFieldMappings } from '@/lib/hubspot/repository';
import { HubSpotClient } from '@/lib/hubspot';
import { seedFieldMappings } from '@/lib/field-mappings/auto-configure';

// Force dynamic rendering for OAuth callback
export const dynamic = 'force-dynamic';

/**
 * GET /api/hubspot/callback
 *
 * OAuth callback handler for HubSpot authorization.
 * Called by HubSpot after user approves the connection.
 *
 * Query params:
 * - code: OAuth authorization code
 * - state: CSRF protection state
 * - hub_id: HubSpot portal ID
 *
 * Auth: public (called by HubSpot)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const hubId = searchParams.get('hub_id');

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=missing_params`
      );
    }

    if (!supabase) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=database_not_configured`
      );
    }

    // Validate state (CSRF protection)
    const { data: stateRecord, error: stateError } = await supabase
      .from('hubspot_oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateRecord) {
      console.error('Invalid OAuth state:', stateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=invalid_state`
      );
    }

    // Check if state is already used
    if (stateRecord.used) {
      console.error('OAuth state already used');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=state_reused`
      );
    }

    // Check if state is expired
    if (new Date(stateRecord.expires_at) < new Date()) {
      console.error('OAuth state expired');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=state_expired`
      );
    }

    // Mark state as used immediately
    await supabase
      .from('hubspot_oauth_states')
      .update({ used: true })
      .eq('state', state);

    // Exchange code for tokens
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/hubspot/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=oauth_not_configured`
      );
    }

    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      expires_in,
    } = tokenData;

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get portal info to determine scopes
    const portalInfoResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + access_token);
    const portalInfo = await portalInfoResponse.json();

    const scopes = portalInfo.scopes || [];
    const portalId = hubId || portalInfo.hub_id?.toString() || '';

    // Check if connection exists
    const { data: existingConnection } = await supabase
      .from('hubspot_connections')
      .select('id, encrypted_token, scopes, has_export_scope')
      .eq('org_id', stateRecord.org_id)
      .maybeSingle();

    // Update existing connection with OAuth tokens
    if (existingConnection) {
      const { error: updateError } = await supabase
        .from('hubspot_connections')
        .update({
          portal_id: portalId,
          hub_id: hubId,
          access_token,
          refresh_token,
          token_expires_at: expiresAt.toISOString(),
          oauth_scopes: scopes,
          connection_status: 'active',
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', stateRecord.org_id);

      if (updateError) {
        console.error('Failed to update connection:', updateError);
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=save_failed`
        );
      }
    } else {
      // Create new OAuth connection
      console.log('[OAuth Callback] Creating new connection:', {
        orgId: stateRecord.org_id,
        portalId,
        hubId,
        connectionStatus: 'active',
      });

      const { error: insertError } = await supabase
        .from('hubspot_connections')
        .insert({
          org_id: stateRecord.org_id,
          portal_id: portalId,
          hub_id: hubId,
          access_token,
          refresh_token,
          token_expires_at: expiresAt.toISOString(),
          oauth_scopes: scopes,
          connection_status: 'active',
          last_active_at: new Date().toISOString(),
          encrypted_token: '', // Empty PAT for OAuth-only connections
          scopes: scopes,
          has_export_scope: scopes.includes('crm.export'),
        });

      if (insertError) {
        console.error('Failed to create connection:', insertError);
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=save_failed`
        );
      }

      console.log('[OAuth Callback] Connection created successfully');
    }

    // Sync workspace schema (discover enum fields)
    try {
      const client = new HubSpotClient(access_token, portalId);
      const schemaResult = await client.syncWorkspaceSchema();

      await upsertSchemaFieldMappings(stateRecord.org_id, schemaResult.enumProperties);

      console.log(`[OAuth callback] Schema sync complete for portal ${portalId}`);
    } catch (schemaSyncError) {
      console.error('[OAuth callback] Schema sync failed (non-fatal):', schemaSyncError);
      // Don't fail the connection - schema sync is best-effort
    }

    // Auto-configure field mappings for standard HubSpot properties
    try {
      const { systemMappingsCreated, propertiesCached } = await seedFieldMappings(
        stateRecord.org_id,
        portalId,
        access_token
      );

      console.log(
        `[OAuth callback] Field mappings auto-configured: ${systemMappingsCreated} system mappings, ${propertiesCached} properties cached`
      );
    } catch (autoConfigError) {
      console.error('[OAuth callback] Auto-configure failed (non-fatal):', autoConfigError);
      // Don't fail the connection - auto-config is best-effort
    }

    // Redirect to connections page with success, preserving org context
    const redirectUrl = new URL('/connections', process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('connected', 'true');
    redirectUrl.searchParams.set('__clerk_org', stateRecord.org_id);
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=unknown`
    );
  }
}
