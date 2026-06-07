import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { addToRegistry } from '@/lib/names/registry';

/**
 * POST /api/name-registry/queue/bulk-approve
 *
 * Bulk approve multiple queue items (admin only).
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const ids = body.ids as string[];

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required' },
        { status: 400 }
      );
    }

    // Fetch all queue items
    const { data: queueItems, error: fetchError } = await supabaseAdmin
      .from('name_registry_queue')
      .select('*')
      .eq('org_id', ctx.orgId)
      .in('id', ids)
      .eq('status', 'pending');

    if (fetchError) {
      captureWithOrgContext(fetchError, ctx.orgId, {
        route: '/api/name-registry/queue/bulk-approve',
      });
      console.error('Failed to fetch queue items:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch queue items' },
        { status: 500 }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json(
        { error: 'No pending queue items found' },
        { status: 404 }
      );
    }

    // Process each queue item
    let approved = 0;
    let failed = 0;

    for (const item of queueItems) {
      try {
        // Add to registry
        // Use 'admin_correction' as source since this is an admin-approved entry
        await addToRegistry(
          ctx.orgId,
          item.registry_type,
          item.input_token,
          item.suggested_canonical,
          'admin_correction',
          item.trigger_context as Record<string, unknown> | undefined
        );

        // Update queue item status
        const { error: updateError } = await supabaseAdmin
          .from('name_registry_queue')
          .update({
            status: 'approved',
            resolved_at: new Date().toISOString(),
            resolved_by: ctx.userId,
          })
          .eq('id', item.id)
          .eq('org_id', ctx.orgId);

        if (updateError) {
          console.error(`Failed to update queue item ${item.id}:`, updateError);
          failed++;
        } else {
          approved++;
          console.log(`[Name Registry Queue] Bulk approved item ${item.id}: ${item.input_token} → ${item.suggested_canonical}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to approve queue item ${item.id}:`, errorMsg);
        failed++;
      }
    }

    return NextResponse.json({
      approved,
      failed,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/name-registry/queue/bulk-approve',
    });
    console.error('Failed to bulk approve queue items:', error);
    return NextResponse.json(
      { error: 'Failed to bulk approve queue items' },
      { status: 500 }
    );
  }
}
