import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { addToRegistry } from '@/lib/names/registry';

/**
 * POST /api/name-registry/queue/[id]/approve
 *
 * Approves a queued item and adds it to the name registry (admin only).
 * Body: { canonical_form?: string } - optional override
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

    // Parse optional body
    let canonical_override: string | undefined;
    try {
      const body = await request.json();
      canonical_override = body.canonical_form;
    } catch {
      // No body or invalid JSON - that's fine
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

    // Determine final canonical form (use override if provided)
    const finalCanonical = canonical_override || queueItem.suggested_canonical;

    // Add to registry with 'active' status
    // Use 'admin_correction' as source since this is an admin-approved entry
    await addToRegistry(
      ctx.orgId,
      queueItem.registry_type,
      queueItem.input_token,
      finalCanonical,
      'admin_correction',
      queueItem.trigger_context as Record<string, unknown> | undefined
    );

    // Update queue item status
    const { error: updateError } = await supabaseAdmin
      .from('name_registry_queue')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
        resolved_by: ctx.userId,
      })
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, {
        route: '/api/name-registry/queue/[id]/approve',
        queueItemId: id,
      });
      console.error('Failed to update queue item:', updateError);
      return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
    }

    // Get the newly created registry entry
    const { data: registryEntry, error: registryError } = await supabaseAdmin
      .from('name_registry')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('registry_type', queueItem.registry_type)
      .eq('input_token', queueItem.input_token.toLowerCase().trim())
      .single();

    console.log(`[Name Registry Queue] Approved item ${id}: ${queueItem.input_token} → ${finalCanonical}`);

    return NextResponse.json({
      success: true,
      registry_id: registryEntry?.id || null,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/name-registry/queue/[id]/approve',
      queueItemId: params.id,
    });
    console.error('Failed to approve queue item:', error);
    return NextResponse.json({ error: 'Failed to approve queue item' }, { status: 500 });
  }
}
