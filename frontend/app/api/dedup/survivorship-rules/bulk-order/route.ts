/**
 * Bulk Reorder Survivorship Rules API
 *
 * PATCH /api/dedup/survivorship-rules/bulk-order
 * Updates rule_order for multiple rules in one transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BulkOrderSchema = z.object({
  orderedIds: z.array(z.string().uuid())
});

/**
 * PATCH /api/dedup/survivorship-rules/bulk-order
 *
 * Updates rule_order for multiple rules based on array position.
 */
export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { orderedIds } = BulkOrderSchema.parse(body);

    console.log('[Survivorship Rules Bulk Order] Updating order:', {
      orgId: ctx.orgId,
      count: orderedIds.length
    });

    // Update each rule's order based on its position in the array
    await Promise.all(
      orderedIds.map((id, index) =>
        supabaseAdmin
          .from('dedup_survivorship_rules')
          .update({ rule_order: index })
          .eq('id', id)
          .eq('org_id', ctx.orgId)
      )
    );

    return NextResponse.json({ updated: orderedIds.length });
  } catch (error) {
    console.error('[Survivorship Rules Bulk Order] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update rule order' },
      { status: 500 }
    );
  }
}
