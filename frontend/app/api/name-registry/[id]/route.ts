/**
 * Name Registry Entry Management API
 *
 * PUT    /api/name-registry/[id] - Update org-scoped entry (admin only)
 * DELETE /api/name-registry/[id] - Soft delete org-scoped entry (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * PUT /api/name-registry/[id]
 *
 * Updates a registry entry's canonical_form.
 * Admin only (requireAdmin).
 *
 * Body:
 *  - canonical_form: string (non-empty)
 *
 * Validates:
 *  - Entry belongs to ctx.orgId (never update global entries)
 *  - canonical_form is non-empty string
 */
export async function PUT(
  request: NextRequest,
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
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { canonical_form } = body;

    // Validate canonical_form
    if (!canonical_form || typeof canonical_form !== 'string' || canonical_form.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid or missing canonical_form. Must be a non-empty string.' },
        { status: 400 }
      );
    }

    // Fetch the registry entry
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('name_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      if (fetchError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
      captureWithOrgContext(fetchError, ctx.orgId, { route: '/api/name-registry/[id]' });
      console.error('Failed to fetch registry entry:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch registry entry' }, { status: 500 });
    }

    // Prevent updating global entries
    if (entry.org_id === null) {
      return NextResponse.json(
        { error: 'Cannot update global registry entries. Only org-specific entries can be updated.' },
        { status: 403 }
      );
    }

    // Verify entry belongs to this org
    if (entry.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Entry not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Update canonical_form and updated_at
    const { error: updateError } = await supabaseAdmin
      .from('name_registry')
      .update({
        canonical_form: canonical_form.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/name-registry/[id]' });
      console.error('Failed to update registry entry:', updateError);
      return NextResponse.json({ error: 'Failed to update registry entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry/[id]' });
    console.error('Failed to update registry entry:', error);
    return NextResponse.json({ error: 'Failed to update registry entry' }, { status: 500 });
  }
}

/**
 * DELETE /api/name-registry/[id]
 *
 * Soft deletes a registry entry by setting status='rejected'.
 * Admin only (requireAdmin).
 *
 * Validates:
 *  - Entry belongs to ctx.orgId (never delete global entries)
 *  - Entry exists and is not already rejected
 */
export async function DELETE(
  request: NextRequest,
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
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Fetch the registry entry
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('name_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      if (fetchError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
      captureWithOrgContext(fetchError, ctx.orgId, { route: '/api/name-registry/[id]' });
      console.error('Failed to fetch registry entry:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch registry entry' }, { status: 500 });
    }

    // Prevent deletion of global entries
    if (entry.org_id === null) {
      return NextResponse.json(
        { error: 'Cannot delete global registry entries. Only org-specific entries can be deleted.' },
        { status: 403 }
      );
    }

    // Verify entry belongs to this org
    if (entry.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Entry not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Soft delete: Set status to 'rejected'
    const { error: updateError } = await supabaseAdmin
      .from('name_registry')
      .update({
        status: 'rejected',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      captureWithOrgContext(updateError, ctx.orgId, { route: '/api/name-registry/[id]' });
      console.error('Failed to delete registry entry:', updateError);
      return NextResponse.json({ error: 'Failed to delete registry entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry/[id]' });
    console.error('Failed to delete registry entry:', error);
    return NextResponse.json({ error: 'Failed to delete registry entry' }, { status: 500 });
  }
}
