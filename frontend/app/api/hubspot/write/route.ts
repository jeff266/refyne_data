/**
 * HubSpot Write API Route
 *
 * POST /api/hubspot/write
 * Writes normalized records back to HubSpot with dedup gate.
 *
 * SECURITY: Requires authentication and portal ownership verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { executeBatchWrite } from '@/lib/hubspot/batch-writer';
import { HubSpotClient } from '@/lib/hubspot/client';
import { decryptToken } from '@/lib/crypto/token-encryption';
import type { RawRecord } from '@/lib/mcp/types';
import type { BatchWriteInput } from '@/lib/hubspot/write-types';

interface WriteRequestBody {
  records: RawRecord[];
  portalId: string;
  dryRun?: boolean;
}

export async function POST(request: NextRequest) {
  // SECURITY: Require authentication
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as WriteRequestBody;

    // Validate request
    if (!body.records || !Array.isArray(body.records)) {
      return NextResponse.json(
        { success: false, error: 'records array is required' },
        { status: 400 }
      );
    }

    if (body.records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'records array cannot be empty' },
        { status: 400 }
      );
    }

    // Validate portalId
    if (!body.portalId) {
      return NextResponse.json(
        { success: false, error: 'portalId is required' },
        { status: 400 }
      );
    }

    // Validate each record has required _id
    for (const record of body.records) {
      if (!record._id) {
        return NextResponse.json(
          { success: false, error: 'Each record must have an _id field' },
          { status: 400 }
        );
      }
    }

    // SECURITY: Verify portal_id belongs to this organization
    const { data: connection, error: connError } = await supabaseAdmin
      .from('hubspot_connections')
      .select('portal_id, access_token, connection_status')
      .eq('org_id', ctx.orgId)
      .eq('portal_id', body.portalId)
      .eq('connection_status', 'active')
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { success: false, error: 'Portal not found or not authorized' },
        { status: 403 }
      );
    }

    // Get decrypted access token from connection
    const accessToken = decryptToken(connection.access_token);

    // Initialize client
    const client = new HubSpotClient(accessToken, body.portalId);

    // Prepare batch write input
    const input: BatchWriteInput = {
      records: body.records,
      dryRun: body.dryRun ?? false,
    };

    // Execute batch write
    const result = await executeBatchWrite(input, client);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('HubSpot write error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
