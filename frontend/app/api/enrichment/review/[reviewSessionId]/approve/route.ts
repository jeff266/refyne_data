import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { generateHarmonyForField } from '@/lib/enrichment/harmony-generator';

/**
 * POST /api/enrichment/review/[reviewSessionId]/approve
 *
 * Triggers HubSpot write for approved review session.
 * Returns write results.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewSessionId: string }> }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { reviewSessionId } = await params;

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Verify session belongs to this org
    const { data: session, error: sessionError } = await supabase
      .from('enrichment_review_sessions')
      .select('*')
      .eq('id', reviewSessionId)
      .eq('org_id', ctx.orgId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Review session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Session already ${session.status}` },
        { status: 400 }
      );
    }

    // Get HubSpot connection
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot connection not found' },
        { status: 404 }
      );
    }

    // Get access token
    const { getAccessToken } = await import('@/lib/hubspot/get-access-token');
    const accessToken = await getAccessToken(ctx.orgId);

    // Get pending values to find unique fields
    const { data: pendingValues } = await supabase
      .from('pending_enrichment_values')
      .select('field_key, raw_value')
      .eq('review_session_id', reviewSessionId);

    if (!pendingValues || pendingValues.length === 0) {
      return NextResponse.json(
        { error: 'No pending values to write' },
        { status: 400 }
      );
    }

    // Generate harmonies for each field if needed
    const fieldKeys = Array.from(new Set(pendingValues.map(v => v.field_key)));
    for (const fieldKey of fieldKeys) {
      const enrichedValues = pendingValues
        .filter(v => v.field_key === fieldKey)
        .map(v => v.raw_value)
        .filter(Boolean);

      // Get valid HubSpot values from field_mappings
      const { data: fieldMapping } = await supabase
        .from('field_mappings')
        .select('valid_values')
        .eq('org_id', ctx.orgId)
        .eq('canonical_field', fieldKey)
        .maybeSingle();

      const hubspotValidValues = fieldMapping?.valid_values || [];

      await generateHarmonyForField(
        ctx.orgId,
        connection.portal_id,
        fieldKey,
        enrichedValues,
        hubspotValidValues
      );
    }

    // Write to HubSpot
    const { HubSpotClient } = await import('@/lib/hubspot/client');
    const hubspotClient = new HubSpotClient(accessToken, connection.portal_id);

    // Get all pending enrichment values
    const { data: allPendingValues } = await supabase
      .from('pending_enrichment_values')
      .select('*')
      .eq('review_session_id', reviewSessionId);

    if (!allPendingValues) {
      return NextResponse.json(
        { error: 'Failed to fetch pending values' },
        { status: 500 }
      );
    }

    // Group by company ID
    const recordsMap = new Map<string, any>();
    for (const value of allPendingValues) {
      if (!recordsMap.has(value.hubspot_company_id)) {
        recordsMap.set(value.hubspot_company_id, {
          id: value.hubspot_company_id,
          properties: {},
        });
      }
      const record = recordsMap.get(value.hubspot_company_id)!;

      // Skip null values and no-match confidence
      if (value.hubspot_value && value.confidence !== 'no_match') {
        record.properties[value.hubspot_property] = value.hubspot_value;
      }
    }

    const recordsToWrite = Array.from(recordsMap.values()).filter(
      r => Object.keys(r.properties).length > 0
    );

    let written = 0;
    let failed = 0;

    // Write in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < recordsToWrite.length; i += BATCH_SIZE) {
      const batch = recordsToWrite.slice(i, i + BATCH_SIZE);

      const { results, errors } = await hubspotClient.batchUpdateCompanies(batch);

      written += results.length;
      failed += errors.length;

      if (errors.length > 0) {
        console.error(
          `[Approve] Batch write errors (${errors.length} total):`,
          JSON.stringify(errors.slice(0, 3), null, 2)
        );
      }

      // Add delay if approaching rate limit
      if (i + BATCH_SIZE < recordsToWrite.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms between batches
      }
    }

    // Update review session status
    await supabase
      .from('enrichment_review_sessions')
      .update({
        status: 'written',
        approved_at: new Date().toISOString(),
        written_at: new Date().toISOString(),
      })
      .eq('id', reviewSessionId);

    // Update arrangement run status to completed
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', session.run_id);

    console.log(`[Approve] Wrote ${written} records to HubSpot (${failed} failed)`);

    return NextResponse.json({
      written,
      skipped: 0,
      failed,
    });
  } catch (error) {
    console.error('[Approve API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to approve and write' },
      { status: 500 }
    );
  }
}
