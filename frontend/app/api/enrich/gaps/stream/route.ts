/**
 * Streaming Gap Analysis API
 *
 * GET /api/enrich/gaps/stream?objectType=company|contact
 *
 * Streams gap analysis results progressively using Server-Sent Events (SSE).
 * Client receives updates after each page of records, showing data within 1-2 seconds.
 * Cache hits return instantly with no delay.
 */

import { NextRequest } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getEnrichableFields } from '@/lib/enrich/enrichable-fields';

const PAGE_SIZE = 100; // Maximum HubSpot allows
const DELAY_BETWEEN_PAGES_MS = 100; // Small delay to avoid rate limits

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildFieldGaps(enrichableFields: string[], fieldCounts: Record<string, number>, totalProcessed: number) {
  return enrichableFields.map(field => {
    const missing = fieldCounts[field] || 0;
    const coverage = totalProcessed > 0
      ? Math.round(((totalProcessed - missing) / totalProcessed) * 100)
      : 0;

    return {
      field,
      missing,
      coverage,
    };
  });
}

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? new Response('Server error', { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return new Response('Database not configured', { status: 503 });
  }

  try {
    // Get objectType from query params
    const { searchParams } = new URL(req.url);
    const objectType = searchParams.get('objectType') ?? 'company';
    const enrichableFields = getEnrichableFields(objectType);

    // Get access token and portal_id
    const accessToken = await getAccessToken(ctx.orgId);
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection) {
      return new Response('HubSpot not connected', { status: 400 });
    }

    const cacheKey = `${ctx.orgId}:${connection.portal_id}:enrich:gaps:${objectType}`;

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Safety check for supabase (already checked above but TS needs reassurance)
          if (!supabase) {
            send({ type: 'error', error: 'Database not configured' });
            controller.close();
            return;
          }

          // Check cache first
          const { data: cached } = await supabase
            .from('cache')
            .select('value, expires_at')
            .eq('key', cacheKey)
            .single();

          if (cached && new Date(cached.expires_at) > new Date()) {
            // Return cached data instantly
            send({
              type: 'complete',
              data: cached.value,
              from_cache: true,
            });
            controller.close();
            return;
          }

          // Stream progressive results
          let after: string | undefined;
          let totalProcessed = 0;
          const fieldCounts: Record<string, number> = {};

          // Send initial state
          send({
            type: 'progress',
            processed: 0,
            total: null,
            fields: [],
          });

          // Paginate through all records
          const hubspotObjectType = objectType === 'contact' ? 'contacts' : 'companies';
          do {
            const properties = enrichableFields.join(',');
            const url = after
              ? `https://api.hubapi.com/crm/v3/objects/${hubspotObjectType}?limit=${PAGE_SIZE}&properties=${properties}&after=${after}`
              : `https://api.hubapi.com/crm/v3/objects/${hubspotObjectType}?limit=${PAGE_SIZE}&properties=${properties}`;

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error(`HubSpot API error: ${response.status}`);
            }

            const page = await response.json();
            const results = page.results || [];

            // Count nulls in this page
            for (const record of results) {
              totalProcessed++;
              for (const field of enrichableFields) {
                const val = record.properties[field];
                if (!val || val.trim() === '' || val === 'null') {
                  fieldCounts[field] = (fieldCounts[field] || 0) + 1;
                }
              }
            }

            after = page.paging?.next?.after;

            // Send progress update after each page
            send({
              type: 'progress',
              processed: totalProcessed,
              total: null, // HubSpot doesn't provide total count
              fields: buildFieldGaps(enrichableFields, fieldCounts, totalProcessed),
              complete: !after,
            });

            // Small delay to avoid rate limits
            if (after) {
              await sleep(DELAY_BETWEEN_PAGES_MS);
            }
          } while (after);

          // Build final result
          const finalResult = {
            total_records: totalProcessed,
            object_type: objectType,
            field_gaps: buildFieldGaps(enrichableFields, fieldCounts, totalProcessed),
            scanned_at: new Date().toISOString(),
          };

          // Cache for 1 hour
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          await supabase
            .from('cache')
            .upsert({
              key: cacheKey,
              value: finalResult,
              expires_at: expiresAt,
            });

          // Send completion event
          send({
            type: 'complete',
            data: finalResult,
            from_cache: false,
          });

          controller.close();
        } catch (error) {
          console.error('[Gap Stream] Error:', error);
          send({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Gap Stream] Setup error:', error);
    return new Response('Failed to start stream', { status: 500 });
  }
}
