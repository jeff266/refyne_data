import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

const DEFAULT_FIELDS = [
  'name',
  'domain',
  'phone',
  'industry',
  'city',
  'state',
  'country',
  'address',
  'linkedin_company_page',
  'lifecyclestage',
  'type',
];

/**
 * GET /api/org/dedup-fields
 *
 * Returns the org's current dedup_display_fields array.
 * If null or empty, returns the default array.
 */
export async function GET(request: NextRequest) {
  // Auth check - get org from Clerk context
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from('org_policies')
      .select('dedup_display_fields')
      .eq('org_id', ctx.orgId)
      .single();

    if (error) {
      // If no row exists, return default
      if (error.code === 'PGRST116') {
        return NextResponse.json({ fields: DEFAULT_FIELDS });
      }
      throw error;
    }

    const fields = data?.dedup_display_fields || DEFAULT_FIELDS;

    return NextResponse.json({ fields });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/dedup-fields' });
    console.error('[Dedup Fields] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch dedup fields' }, { status: 500 });
  }
}

/**
 * PUT /api/org/dedup-fields
 *
 * Updates the org's dedup_display_fields column.
 * Accepts { fields: string[] } and persists to database.
 */
export async function PUT(request: NextRequest) {
  // Auth check - get org from Clerk context
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { fields } = body;

    if (!Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields must be an array' }, { status: 400 });
    }

    // Validate that fields is an array of strings
    if (!fields.every((f) => typeof f === 'string')) {
      return NextResponse.json({ error: 'All fields must be strings' }, { status: 400 });
    }

    const { error } = await supabase
      .from('org_policies')
      .update({ dedup_display_fields: fields })
      .eq('org_id', ctx.orgId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, fields });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/dedup-fields' });
    console.error('[Dedup Fields] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to update dedup fields' }, { status: 500 });
  }
}
