/**
 * Enrich Apply API
 *
 * POST /api/enrich/apply
 *
 * Applies cached preview results to HubSpot companies.
 * Only writes fields where would_write is true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { Redis } from '@upstash/redis';

// Initialize Redis from URL (extracts token from URL automatically)
const redis = process.env.UPSTASH_REDIS_URL
  ? Redis.fromEnv()
  : null;

interface ApplyRequest {
  preview_id: string;
}

interface ApplyResponse {
  applied: number;
  failed: number;
  skipped: number;
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis not configured' },
        { status: 503 }
      );
    }

    const body: ApplyRequest = await req.json();

    if (!body.preview_id) {
      return NextResponse.json({ error: 'No preview_id provided' }, { status: 400 });
    }

    // Retrieve preview results from Redis
    const cacheKey = `${ctx.orgId}:enrich:preview:${body.preview_id}`;
    const cached = await redis.get(cacheKey);

    if (!cached) {
      return NextResponse.json(
        { error: 'Preview not found or expired' },
        { status: 404 }
      );
    }

    const previewResults = typeof cached === 'string' ? JSON.parse(cached) : cached;

    // Get HubSpot access token
    const accessToken = await getAccessToken(ctx.orgId);

    // Get portal info
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Build batch update records
    const recordsToUpdate: Array<{
      id: string;
      properties: Record<string, string>;
    }> = [];

    for (const companyResult of previewResults.results) {
      const properties: Record<string, string> = {};

      for (const field of companyResult.fields) {
        if (field.would_write && field.after) {
          properties[field.field_key] = field.after;
        }
      }

      if (Object.keys(properties).length > 0) {
        recordsToUpdate.push({
          id: companyResult.hubspot_company_id,
          properties,
        });
      }
    }

    if (recordsToUpdate.length === 0) {
      return NextResponse.json({
        applied: 0,
        failed: 0,
        skipped: previewResults.results.length,
      });
    }

    // Batch update via HubSpot client
    const { results, errors } = await hubspot.batchUpdateCompanies(recordsToUpdate);

    const response: ApplyResponse = {
      applied: results.length,
      failed: errors.length,
      skipped: previewResults.results.length - recordsToUpdate.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Apply] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
