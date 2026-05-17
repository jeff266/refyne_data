/**
 * HubSpot Write API Route
 *
 * POST /api/hubspot/write
 * Writes normalized records back to HubSpot with dedup gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeBatchWrite } from '@/lib/hubspot/batch-writer';
import { HubSpotClient } from '@/lib/hubspot/client';
import type { RawRecord } from '@/lib/mcp/types';
import type { BatchWriteInput } from '@/lib/hubspot/write-types';

interface WriteRequestBody {
  records: RawRecord[];
  portalId: string;
  dryRun?: boolean;
}

export async function POST(request: NextRequest) {
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

    // Get HubSpot access token from environment
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'HubSpot access token not configured' },
        { status: 500 }
      );
    }

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
