import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { transformKeys } from '@/lib/utils/transform';

interface UpdateFieldMappingBody {
  hubspot_property?: string;
  direction?: 'read' | 'write' | 'bidirectional';
  write_policy?: 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';
  is_active?: boolean;
}

/**
 * PUT /api/field-mappings/:id
 *
 * Update a field mapping for the current org.
 */
export async function PUT(
  request: NextRequest,
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

    const body = await request.json() as UpdateFieldMappingBody;

    // Validate write_policy if provided
    if (body.write_policy) {
      const validPolicies = ['always_overwrite', 'overwrite_if_blank_or_ours', 'never_overwrite'];
      if (!validPolicies.includes(body.write_policy)) {
        return NextResponse.json(
          { error: 'Invalid write_policy', field: 'write_policy' },
          { status: 400 }
        );
      }
    }

    // Validate direction if provided
    if (body.direction) {
      const validDirections = ['read', 'write', 'bidirectional'];
      if (!validDirections.includes(body.direction)) {
        return NextResponse.json(
          { error: 'Invalid direction', field: 'direction' },
          { status: 400 }
        );
      }
    }

    // Update the field mapping
    const { data, error } = await supabase
      .from('field_mappings')
      .update(body)
      .eq('id', params.id)
      .eq('org_id', ctx.orgId) // Ensure org can only update their own mappings
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Field mapping not found' },
          { status: 404 }
        );
      }
      captureWithOrgContext(error, ctx.orgId, { route: '/api/field-mappings/:id' });
      console.error('Failed to update field mapping:', error);
      return NextResponse.json(
        { error: 'Failed to update field mapping' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mapping: transformKeys(data)
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/field-mappings/:id' });
    console.error('Failed to update field mapping:', error);
    return NextResponse.json(
      { error: 'Failed to update field mapping' },
      { status: 500 }
    );
  }
}
