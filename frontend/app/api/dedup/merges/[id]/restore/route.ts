import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/dedup/merges/[id]/restore
 *
 * Re-creates the absorbed record from merged_snapshot.
 * Reverts a merge operation by restoring the deleted duplicate as a new company.
 *
 * WARNING: Associations (contacts, deals) that moved to the master during merge
 * will NOT be automatically moved back. This creates a new blank company with
 * the original field values only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Fetch the merge history record
    const { data: merge, error: fetchError } = await supabase
      .from('dedup_merge_history')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !merge) {
      return NextResponse.json({ error: 'Merge not found' }, { status: 404 });
    }

    const snapshot = merge.merged_snapshot as Record<string, any>;

    // Get HubSpot access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Re-create the absorbed record in HubSpot from snapshot
    // Use the properties from merged_snapshot, excluding HubSpot system fields
    const systemFields = [
      'hs_object_id',
      'createdate',
      'hs_lastmodifieddate',
      'hs_createdate',
      'hs_merged_object_ids',
      'notes_last_contacted',
      'notes_last_updated',
      'notes_next_activity_date',
      'num_contacted_notes',
      'num_notes',
    ];

    const properties = Object.fromEntries(
      Object.entries(snapshot)
        .filter(([key]) => !systemFields.includes(key))
        .filter(([, val]) => val !== null && val !== '')
    );

    // Create new company in HubSpot
    const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties,
        associations: [],
      }),
    });

    if (!createRes.ok) {
      const error = await createRes.text();
      console.error('[Merge Restore] Failed to create company:', error);
      return NextResponse.json(
        { error: 'Failed to restore record in HubSpot', details: error },
        { status: 500 }
      );
    }

    const restored = await createRes.json();

    // Log the restoration as a new merge history entry
    await supabase.from('dedup_merge_history').insert({
      org_id: ctx.orgId,
      cluster_id: merge.cluster_id,
      merged_by: ctx.userId,
      merged_by_name: null, // TODO: Fetch from Clerk
      merged_at: new Date().toISOString(),
      merge_method: 'restore',
      survivor_record_id: restored.id,
      merged_record_id: merge.survivor_record_id,
      survivor_snapshot: snapshot,
      merged_snapshot: merge.survivor_snapshot,
      result_snapshot: { restored_id: restored.id, original_merge_id: merge.id },
      field_selections: null,
      confidence_score: merge.confidence_score,
      similarity_signals: merge.similarity_signals,
    });

    // Re-open the original cluster so it appears in the review queue again
    await supabase
      .from('dedup_clusters')
      .update({
        status: 'open',  // Reopen for review
        resolved_at: null,
        resolved_by: null,
      })
      .eq('id', merge.cluster_id);

    return NextResponse.json({
      restored: true,
      newRecordId: restored.id,
      originalRecordId: merge.merged_record_id,
      message: `Record restored as HubSpot company ${restored.id}`,
    });
  } catch (error) {
    console.error('[Merge Restore] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to restore merge',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
