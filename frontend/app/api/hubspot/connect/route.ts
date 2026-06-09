import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { validateToken, saveConnection, getConnection, deleteConnection, HubSpotClient } from '@/lib/hubspot';
import { upsertSchemaFieldMappings } from '@/lib/hubspot/repository';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';
import { encryptToken } from '@/lib/crypto/token-encryption';

/**
 * GET /api/hubspot/connect
 *
 * Initiates HubSpot OAuth flow by generating a CSRF state token
 * and redirecting to HubSpot's authorization URL.
 *
 * Query params:
 * - return_to: Optional relative path to redirect after OAuth (e.g., /onboarding/connect)
 *
 * Auth: admin only
 */
export async function GET(request: NextRequest) {
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
      // Core company permissions
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.schemas.companies.read',
      'crm.schemas.companies.write',  // NEW: schema sync with write access
      // Contact permissions (required for contacts normalization)
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.schemas.contacts.read',
      // Export API for streaming (CRITICAL - enables memory-efficient processing)
      'crm.export',
      // Lists and owners
      'crm.lists.write',  // Upgraded from read
      'crm.objects.owners.read',  // NEW: owner information
      // OAuth
      'oauth',
    ];

    const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);

    // Store return_to in cookie if provided and valid
    const returnTo = request.nextUrl.searchParams.get('return_to');
    const headers = new Headers();

    if (returnTo && returnTo.startsWith('/') && !returnTo.includes('://')) {
      // Valid relative path - store in HttpOnly cookie with 10 minute expiry
      headers.append(
        'Set-Cookie',
        `oauth_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
      );
      console.log('[HubSpot Connect] Stored return_to in cookie:', returnTo);
    }

    // Redirect to HubSpot
    return NextResponse.redirect(authUrl.toString(), headers.size > 0 ? { headers } : undefined);
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

    // Encrypt the token before storing (AES-256-GCM)
    const encryptedToken = encryptToken(token);

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

  requireAdmin(ctx.orgRole);

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
