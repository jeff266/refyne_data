import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { upsertSchemaFieldMappings } from '@/lib/hubspot/repository';
import { HubSpotClient } from '@/lib/hubspot';
import { seedFieldMappings } from '@/lib/field-mappings/auto-configure';
import { encryptToken } from '@/lib/crypto/token-encryption';
import { startTrial } from '@/lib/billing/trial';
import { track } from '@/lib/telemetry/track';

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
  console.log('[OAuth Callback] START - Received callback from HubSpot');
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const hubId = searchParams.get('hub_id');

    console.log('[OAuth Callback] Params:', { hasCode: !!code, hasState: !!state, hubId });

    if (!code || !state) {
      console.error('[OAuth Callback] Missing required params');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=missing_params`
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=database_not_configured`
      );
    }

    // Validate state (CSRF protection)
    // NOTE: Must use supabaseAdmin because this is a public endpoint (no auth context)
    // and hubspot_oauth_states has RLS that requires org_id from auth
    const { data: stateRecord, error: stateError } = await supabaseAdmin
      .from('hubspot_oauth_states')
      .select('id, state, org_id, created_by, used_at, created_at, return_to, expires_at, used')
      .eq('state', state)
      .single();

    if (stateError || !stateRecord) {
      console.error('[OAuth Callback] Invalid OAuth state:', stateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=invalid_state`
      );
    }

    console.log('[OAuth Callback] State validated:', {
      orgId: stateRecord.org_id,
      returnTo: stateRecord.return_to,
      used: stateRecord.used,
      expiresAt: stateRecord.expires_at
    });

    // Check if state is already used
    if (stateRecord.used) {
      console.error('[OAuth Callback] OAuth state already used');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=state_reused`
      );
    }

    // Check if state is expired
    if (new Date(stateRecord.expires_at) < new Date()) {
      console.error('[OAuth Callback] OAuth state expired');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=state_expired`
      );
    }

    console.log('[OAuth Callback] Marking state as used');
    // Mark state as used immediately
    await supabaseAdmin
      .from('hubspot_oauth_states')
      .update({ used: true })
      .eq('state', state);

    // Exchange code for tokens
    console.log('[OAuth Callback] Exchanging code for tokens');
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/hubspot/callback`;

    if (!clientId || !clientSecret) {
      console.error('[OAuth Callback] Missing OAuth credentials');
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
      console.error('[OAuth Callback] Token exchange failed:', errorData);
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

    console.log('[OAuth Callback] Token exchange successful, expires_in:', expires_in);

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get portal info to determine scopes
    console.log('[OAuth Callback] Fetching portal info');
    const portalInfoResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + access_token);
    const portalInfo = await portalInfoResponse.json();

    const scopes = portalInfo.scopes || [];
    const portalId = hubId || portalInfo.hub_id?.toString() || '';

    console.log('[OAuth Callback] Portal info:', { portalId, scopeCount: scopes.length });

    // Check if connection exists
    console.log('[OAuth Callback] Checking for existing connection');
    const { data: existingConnection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('id, encrypted_token, scopes, has_export_scope')
      .eq('org_id', stateRecord.org_id)
      .maybeSingle();

    console.log('[OAuth Callback] Existing connection:', existingConnection ? 'found' : 'not found');

    // Update existing connection with OAuth tokens
    if (existingConnection) {
      // Encrypt tokens before storing
      const encryptedAccessToken = encryptToken(access_token);
      const encryptedRefreshToken = encryptToken(refresh_token);

      const { error: updateError } = await supabaseAdmin
        .from('hubspot_connections')
        .update({
          portal_id: portalId,
          hub_id: hubId,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
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

      // Encrypt tokens before storing
      const encryptedAccessToken = encryptToken(access_token);
      const encryptedRefreshToken = encryptToken(refresh_token);

      const { error: insertError } = await supabaseAdmin
        .from('hubspot_connections')
        .insert({
          org_id: stateRecord.org_id,
          portal_id: portalId,
          hub_id: hubId,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
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

    // Track hubspot_connected event
    track({
      event: 'hubspot_connected',
      orgId: stateRecord.org_id,
      metadata: { portal_id: portalId, scopes },
    });

    // Auto-provision org_billing record on first HubSpot connection (trial start)
    try {
      const { data: existingBilling } = await supabaseAdmin
        .from('org_billing')
        .select('org_id')
        .eq('org_id', stateRecord.org_id)
        .maybeSingle();

      if (!existingBilling) {
        await supabaseAdmin.from('org_billing').insert({
          org_id: stateRecord.org_id,
          subscription_tier: 'trial',
          subscription_status: 'active',
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        });

        console.log(`[OAuth Callback] org_billing provisioned for org ${stateRecord.org_id}`);

        // Provision feature flags for new org
        const { FEATURE_FLAGS } = await import('@/lib/features/flags');
        const flags = Object.values(FEATURE_FLAGS);
        await supabaseAdmin.from('org_feature_flags').upsert(
          flags.map(flag => ({
            org_id: stateRecord.org_id,
            flag,
            enabled: false
          })),
          { onConflict: 'org_id,flag', ignoreDuplicates: true }
        );

        console.log(`[OAuth Callback] Feature flags provisioned for org ${stateRecord.org_id}`);
      }
    } catch (billingError) {
      console.error('[OAuth Callback] org_billing provisioning failed (non-fatal):', billingError);
      // Don't fail the connection - billing provisioning is best-effort
    }

    // Auto-start trial on first HubSpot connection
    try {
      await startTrial(supabaseAdmin, stateRecord.org_id);
      console.log(`[OAuth Callback] Trial auto-started for org ${stateRecord.org_id}`);
    } catch (trialError) {
      console.error('[OAuth Callback] Trial auto-start failed (non-fatal):', trialError);
      // Don't fail the connection - trial start is best-effort
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

    // Auto-trigger full dedup scan after first connection
    try {
      const scanResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/dedup/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': stateRecord.org_id,
        },
        body: JSON.stringify({ forceFullScan: true }),
      });

      if (scanResponse.ok) {
        const scanResult = await scanResponse.json();
        console.log(
          `[OAuth callback] Auto-triggered full dedup scan: jobId=${scanResult.jobId}, scanType=${scanResult.scanType}`
        );
      } else {
        const errorText = await scanResponse.text();
        console.error('[OAuth callback] Auto-scan failed (non-fatal):', errorText);
      }
    } catch (autoScanError) {
      console.error('[OAuth callback] Auto-scan failed (non-fatal):', autoScanError);
      // Don't fail the connection - auto-scan is best-effort
    }

    // Read return_to from state record (persisted in database)
    let returnTo = stateRecord.return_to || null;

    console.log('[OAuth Callback] return_to from state:', returnTo);

    // Validate return_to is a relative path (security)
    if (returnTo && (!returnTo.startsWith('/') || returnTo.includes('://'))) {
      console.warn('[OAuth Callback] Invalid return_to rejected:', returnTo);
      returnTo = null;
    }

    const redirectPath = returnTo || '/connections';
    console.log('[OAuth Callback] Final redirect path:', redirectPath);

    // Update onboarding progress if returning to onboarding flow
    if (returnTo?.includes('/onboarding')) {
      try {
        await supabaseAdmin
          .from('onboarding_progress')
          .upsert({
            org_id: stateRecord.org_id,
            connected_hubspot: true,
          }, { onConflict: 'org_id' });
        console.log('[OAuth Callback] Updated onboarding_progress.connected_hubspot');
      } catch (err) {
        console.error('[OAuth Callback] Failed to update onboarding progress (non-fatal):', err);
        // Non-fatal, continue
      }
    }

    // Redirect with success, preserving org context
    const redirectUrl = new URL(redirectPath, process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('connected', 'true');
    redirectUrl.searchParams.set('__clerk_org', stateRecord.org_id);

    console.log('[OAuth Callback] SUCCESS - Redirecting to:', redirectUrl.toString());

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[OAuth Callback] FATAL ERROR:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=unknown`
    );
  }
}
