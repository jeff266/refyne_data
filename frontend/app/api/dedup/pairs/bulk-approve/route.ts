import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { BulkApproveRequest, BulkApproveResponse } from '@/lib/dedup/types';

/**
 * POST /api/dedup/pairs/bulk-approve
 *
 * Approve multiple pairs for merge.
 * Editor or admin role required.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = request.headers.get('x-org-id') || 'default';
    // TODO: Check editor or admin role

    const body = await request.json() as BulkApproveRequest;

    // Validate request
    if (!Array.isArray(body.pairIds) || body.pairIds.length === 0) {
      return NextResponse.json(
        { error: 'pairIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (body.pairIds.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 pairs per request' },
        { status: 400 }
      );
    }

    // Verify all pairs exist, belong to org, and are pending
    const { data: pairs, error: selectError } = await supabase
      .from('dedup_pairs')
      .select('id, status')
      .eq('org_id', orgId)
      .in('id', body.pairIds);

    if (selectError) {
      console.error('Failed to validate pairs:', selectError);
      return NextResponse.json(
        { error: 'Failed to validate pairs' },
        { status: 500 }
      );
    }

    // Check for invalid IDs
    const foundIds = new Set(pairs?.map((p) => p.id) || []);
    const invalidIds = body.pairIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Some pair IDs not found', invalidIds },
        { status: 400 }
      );
    }

    // Check for non-pending pairs
    const nonPendingIds = pairs?.filter((p) => p.status !== 'pending').map((p) => p.id) || [];
    if (nonPendingIds.length > 0) {
      return NextResponse.json(
        { error: 'Some pairs are not pending', invalidIds: nonPendingIds },
        { status: 400 }
      );
    }

    // Update all pairs to approved
    const { error: updateError } = await supabase
      .from('dedup_pairs')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .in('id', body.pairIds);

    if (updateError) {
      console.error('Failed to approve pairs:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve pairs' },
        { status: 500 }
      );
    }

    // TODO: Enqueue BullMQ merge jobs for each pair
    const jobIds = body.pairIds.map((id) => `merge:${id}:${Date.now()}`);

    const response: BulkApproveResponse = {
      queued: body.pairIds.length,
      jobIds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to bulk approve pairs:', error);
    return NextResponse.json(
      { error: 'Failed to bulk approve pairs' },
      { status: 500 }
    );
  }
}
