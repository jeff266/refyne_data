import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { validateToken, saveConnection, getConnection, deleteConnection, HubSpotClient } from '@/lib/hubspot';
import { upsertSchemaFieldMappings } from '@/lib/hubspot/repository';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';

/**
 * GET /api/hubspot/connect
 *
 * Initiates HubSpot OAuth flow by generating a CSRF state token
 * and redirecting to HubSpot's authorization URL.
 *
 * Auth: admin only
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
    // Allow admin or operator to connect HubSpot
    if (ctx.orgRole === 'org:viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions - admin or operator required' },
        { status: 403 }
      );
    }
  } catch (e) {
    console.error('[HubSpot Connect] Auth error:', e);
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check org rate limit
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/hubspot/connect');
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitCheck.resetAt!, rateLimitCheck.remaining!),
      { status: 429 }
    );
  }

  try {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/hubspot/callback`;

    console.log('[HubSpot Connect] Starting OAuth flow', {
      orgId: ctx.orgId,
      userId: ctx.userId,
      role: ctx.orgRole,
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
    });

    if (!clientId) {
      console.error('[HubSpot Connect] Missing HUBSPOT_CLIENT_ID');
      return NextResponse.json(
        { error: 'HubSpot OAuth not configured' },
        { status: 500 }
      );
    }

    if (!supabase) {
      console.error('[HubSpot Connect] Supabase not configured');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Generate cryptographically random state (32 bytes hex = 64 characters)
    const state = randomBytes(32).toString('hex');

    console.log('[HubSpot Connect] Storing OAuth state in database...');

    // Store state in database for CSRF protection
    const { error } = await supabase
      .from('hubspot_oauth_states')
      .insert({
        state,
        org_id: ctx.orgId,
        created_by: ctx.userId,
      });

    if (error) {
      console.error('[HubSpot Connect] Failed to store OAuth state:', error);
      captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connect' });
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow', details: error.message },
        { status: 500 }
      );
    }

    console.log('[HubSpot Connect] OAuth state stored successfully');

    // Build HubSpot OAuth URL with full scope list
    const scopes = [
      // Required
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.schemas.companies.read',
      'oauth',
      // Conditionally required
      'crm.export',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.schemas.contacts.read',
      'crm.lists.read',
    ];

    const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);

    // Redirect to HubSpot
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('OAuth connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hubspot/connect
 *
 * Validate and save a HubSpot access token.
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate the token
    const validation = await validateToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error || 'Invalid token',
          missingScopes: validation.missingScopes,
        },
        { status: 400 }
      );
    }

    const orgId = ctx.orgId;

    // TODO: Encrypt the token before storing
    // For now, storing plain text (should use AES-256-GCM in production)
    const encryptedToken = token;

    // Save the connection
    const connection = await saveConnection(
      orgId,
      validation.portalId!,
      encryptedToken,
      validation.scopes || [],
      validation.hasExportScope ?? false
    );

    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      );
    }

    // Sync workspace schema (discover enum fields)
    let schemaSyncResult = null;
    try {
      const client = new HubSpotClient(token, validation.portalId!);
      const schemaResult = await client.syncWorkspaceSchema();

      // Upsert schema-discovered field mappings
      const upsertResult = await upsertSchemaFieldMappings(orgId, schemaResult.enumProperties);

      schemaSyncResult = {
        companyPropertyCount: schemaResult.companyPropertyCount,
        contactPropertyCount: schemaResult.contactPropertyCount,
        enumPropertyCount: schemaResult.enumPropertyCount,
        mappingsUpserted: upsertResult.upserted,
        mappingErrors: upsertResult.errors,
      };

      console.log(`[connect] Schema sync complete for portal ${validation.portalId}:`, schemaSyncResult);
    } catch (schemaSyncError) {
      console.error('[connect] Schema sync failed (non-fatal):', schemaSyncError);
      // Don't fail the connection - schema sync is best-effort
    }

    return NextResponse.json({
      success: true,
      portalId: connection.portalId,
      scopes: connection.scopes,
      hasExportScope: connection.hasExportScope,
      schemaSync: schemaSyncResult,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connect' });
    console.error('Failed to connect HubSpot:', error);
    return NextResponse.json(
      { error: 'Failed to connect to HubSpot' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hubspot/connect
 *
 * Disconnect HubSpot from the org.
 */
export async function DELETE(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;

    const deleted = await deleteConnection(orgId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to disconnect or no connection exists' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connect' });
    console.error('Failed to disconnect HubSpot:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from HubSpot' },
      { status: 500 }
    );
  }
}
