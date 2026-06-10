import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dedup/field-exclusions
 *
 * List field exclusions for the org.
 * Auth: getOrgContext()
 * Query: ?objectType=company|contact
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const objectType = searchParams.get('objectType') || 'company';

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: exclusions, error } = await supabase
      .from('dedup_field_exclusions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Field Exclusions] Error fetching:', error);
      return NextResponse.json({ error: 'Failed to fetch field exclusions' }, { status: 500 });
    }

    return NextResponse.json({ exclusions: exclusions || [] });
  } catch (error) {
    console.error('[Field Exclusions] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch field exclusions' }, { status: 500 });
  }
}

/**
 * POST /api/dedup/field-exclusions
 *
 * Create a field exclusion.
 * Auth: requireAdmin()
 * Body: { fieldName, objectType, exclusionType, separator? }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { fieldName, objectType = 'company', exclusionType, separator } = body;

    if (!fieldName) {
      return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
    }

    if (!['never_merge', 'union_true', 'append'].includes(exclusionType)) {
      return NextResponse.json(
        { error: 'Invalid exclusion type. Must be never_merge, union_true, or append' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Insert (UNIQUE constraint prevents duplicates)
    const { data, error } = await supabase
      .from('dedup_field_exclusions')
      .insert({
        org_id: ctx.orgId,
        object_type: objectType,
        field_name: fieldName,
        exclusion_type: exclusionType,
        separator: separator || '\n',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'Field exclusion already exists for this field' },
          { status: 409 }
        );
      }

      console.error('[Field Exclusions] Error creating:', error);
      return NextResponse.json({ error: 'Failed to create field exclusion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, exclusion: data });
  } catch (error) {
    console.error('[Field Exclusions] Error:', error);
    return NextResponse.json({ error: 'Failed to create field exclusion' }, { status: 500 });
  }
}
