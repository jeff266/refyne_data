import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { validateToken, saveConnection, getConnection, deleteConnection, HubSpotClient } from '@/lib/hubspot';
import { upsertSchemaFieldMappings } from '@/lib/hubspot/repository';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';

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
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/hubspot/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'HubSpot OAuth not configured' },
        { status: 500 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Generate cryptographically random state (32 bytes hex = 64 characters)
    const state = randomBytes(32).toString('hex');

    // Store state in database for CSRF protection
    const { error } = await supabase
      .from('hubspot_oauth_states')
      .insert({
        state,
        org_id: ctx.orgId,
        created_by: ctx.userId,
      });

    if (error) {
      console.error('Failed to store OAuth state:', error);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500 }
      );
    }

    // Build HubSpot OAuth URL
    const scopes = [
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.export',
      'oauth',
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
    console.error('Failed to disconnect HubSpot:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from HubSpot' },
      { status: 500 }
    );
  }
}
