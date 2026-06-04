import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/harmonies/[id]
 *
 * Returns harmony configuration and field assignments.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Fetch harmony (preset harmonies have org_id = null, org-specific have org_id = ctx.orgId)
    const { data: harmony, error: harmonyError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
      .single();

    if (harmonyError || !harmony) {
      console.error('[Harmony Detail] Not found:', harmonyError);
      return NextResponse.json(
        { error: 'Harmony not found' },
        { status: 404 }
      );
    }

    // Fetch field assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('harmony_field_assignments')
      .select('canonical_field, hubspot_property')
      .eq('harmony_id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

    if (assignmentsError) {
      console.error('[Harmony Detail] Failed to fetch assignments:', assignmentsError);
      return NextResponse.json(
        { error: 'Failed to fetch field assignments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: harmony.id,
      name: harmony.name,
      description: harmony.description,
      transformType: harmony.transform_type,
      transformFunction: harmony.transform_function,
      referenceTable: harmony.reference_table,
      objectType: harmony.object_type,
      isActive: harmony.is_active,
      isPreset: harmony.is_preset || false,
      isArchived: harmony.is_archived || false,
      writePolicy: harmony.write_policy || 'fill_empty',
      fieldAssignments: (assignments || []).map(a => ({
        canonicalField: a.canonical_field,
        hubspotProperty: a.hubspot_property,
      })),
    });
  } catch (error) {
    console.error('[Harmony Detail] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch harmony' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/harmonies/[id]
 *
 * Updates harmony name, description, write_policy, and is_active.
 * Never allows updating transform_type, transform_function, or reference_table (library-defined).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await req.json();
    const { name, description, writePolicy, isActive, isArchived } = body;

    // Build update object with only allowed fields
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (writePolicy !== undefined) updates.write_policy = writePolicy;
    if (isActive !== undefined) updates.is_active = isActive;
    if (isArchived !== undefined) updates.is_archived = isArchived;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update harmony (only if it's preset or owned by this org)
    const { error: updateError } = await supabase
      .from('harmonies')
      .update(updates)
      .eq('id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

    if (updateError) {
      console.error('[Harmony Update] Failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update harmony' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Harmony Update] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update harmony' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/harmonies/[id]
 *
 * Permanently deletes a custom harmony and all its reference data.
 * Only allowed for:
 * - Custom harmonies (is_preset = false)
 * - Already archived harmonies (is_archived = true)
 * - Owned by this org (org_id = ctx.orgId)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Fetch harmony to verify it can be deleted
    const { data: harmony, error: fetchError } = await supabase
      .from('harmonies')
      .select('id, org_id, is_preset, is_archived')
      .eq('id', id)
      .eq('org_id', ctx.orgId) // Must be owned by this org
      .single();

    if (fetchError || !harmony) {
      return NextResponse.json(
        { error: 'Harmony not found or not owned by your organization' },
        { status: 404 }
      );
    }

    // Verify it's not a library harmony
    if (harmony.is_preset) {
      return NextResponse.json(
        { error: 'Cannot delete library harmonies. Use deactivate instead.' },
        { status: 403 }
      );
    }

    // Verify it's archived
    if (!harmony.is_archived) {
      return NextResponse.json(
        { error: 'Harmony must be archived before deletion' },
        { status: 403 }
      );
    }

    // Delete reference data
    const { error: refDataError } = await supabase
      .from('harmony_reference_data')
      .delete()
      .eq('table_name', id)
      .eq('org_id', ctx.orgId);

    if (refDataError) {
      console.error('[Harmony Delete] Failed to delete reference data:', refDataError);
      // Continue anyway - reference data might not exist
    }

    // Delete taxonomy suggestions
    const { error: suggestionsError } = await supabase
      .from('taxonomy_suggestions')
      .delete()
      .eq('harmony_id', id)
      .eq('org_id', ctx.orgId);

    if (suggestionsError) {
      console.error('[Harmony Delete] Failed to delete suggestions:', suggestionsError);
      // Continue anyway - suggestions might not exist
    }

    // Delete field assignments
    const { error: assignmentsError } = await supabase
      .from('harmony_field_assignments')
      .delete()
      .eq('harmony_id', id)
      .eq('org_id', ctx.orgId);

    if (assignmentsError) {
      console.error('[Harmony Delete] Failed to delete assignments:', assignmentsError);
      // Continue anyway
    }

    // Delete harmony
    const { error: deleteError } = await supabase
      .from('harmonies')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (deleteError) {
      console.error('[Harmony Delete] Failed:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete harmony' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Harmony Delete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete harmony' },
      { status: 500 }
    );
  }
}
