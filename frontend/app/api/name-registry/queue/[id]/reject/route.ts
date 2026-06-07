import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/name-registry/queue/[id]/reject
 *
 * Rejects a queued item and prevents re-queuing (admin only).
 * Creates a 'rejected' registry entry to block re-queuing for 30 days.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Get the queue item
    const { data: queueItem, error: fetchError } = await supabaseAdmin
      .from('name_registry_queue')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !queueItem) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (queueItem.status !== 'pending') {
      return NextResponse.json(
        { error: `Item already ${queueItem.status}` },
        { status: 400 }
      );
    }

    // Update queue item to rejected
    const { error: updateError } = await supabaseAdmin
      .from('name_registry_queue')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: ctx.userId,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, {
        route: '/api/name-registry/queue/[id]/reject',
        queueItemId: id,
      });
      console.error('Failed to reject queue item:', updateError);
      return NextResponse.json({ error: 'Failed to reject queue item' }, { status: 500 });
    }

    // Insert rejection record in name_registry to prevent re-queuing
    // Uses the same input_token as the queue item but with status='rejected'
    const { error: registryError } = await supabaseAdmin
      .from('name_registry')
      .insert({
        org_id: ctx.orgId,
        registry_type: queueItem.registry_type,
        input_token: queueItem.input_token.toLowerCase().trim(),
        canonical_form: queueItem.suggested_canonical, // Store what was suggested (for audit)
        source: 'admin_correction',
        status: 'rejected',
        confidence: 1.00,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      });

    if (registryError) {
      // If duplicate key error, that's fine - rejection already exists
      if (!registryError.message?.includes('duplicate key')) {
        captureWithOrgContext(registryError, ctx.orgId, {
          route: '/api/name-registry/queue/[id]/reject',
          queueItemId: id,
        });
        console.error('Failed to create rejection record:', registryError);
        // Don't fail the whole request - queue item is already rejected
      }
    }

    console.log(`[Name Registry Queue] Rejected item ${id}: ${queueItem.input_token}`);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/name-registry/queue/[id]/reject',
      queueItemId: params.id,
    });
    console.error('Failed to reject queue item:', error);
    return NextResponse.json({ error: 'Failed to reject queue item' }, { status: 500 });
  }
}
