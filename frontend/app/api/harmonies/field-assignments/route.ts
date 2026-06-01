/**
 * GET /api/harmonies/field-assignments
 *
 * Returns field assignments for the current org, merging global defaults
 * with org-specific overrides.
 *
 * POST /api/harmonies/field-assignments
 *
 * Creates a new field assignment for the current org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getFieldAssignments } from '@/lib/harmonies/field-assignments';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const objectType = searchParams.get('objectType') || 'company';

    if (!['company', 'contact', 'deal'].includes(objectType)) {
      return NextResponse.json(
        { error: 'Invalid objectType. Must be company, contact, or deal' },
        { status: 400 }
      );
    }

    const assignments = await getFieldAssignments(
      ctx.orgId,
      objectType as 'company' | 'contact' | 'deal'
    );

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('[Field Assignments API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { harmonyId, objectType, canonicalField, hubspotProperty, outputFormat } = body;

    if (!harmonyId || !objectType || !canonicalField || !hubspotProperty) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('harmony_field_assignments')
      .insert({
        org_id: ctx.orgId,
        harmony_id: harmonyId,
        object_type: objectType,
        canonical_field: canonicalField,
        hubspot_property: hubspotProperty,
        output_format: outputFormat ?? null,
        is_active: true,
        priority: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 });
      }
      console.error('[Field Assignments API] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assignment: data }, { status: 201 });
  } catch (error) {
    console.error('[Field Assignments API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create field assignment' },
      { status: 500 }
    );
  }
}
