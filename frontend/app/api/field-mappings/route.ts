import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

export interface FieldMapping {
  id: string;
  org_id: string;
  canonical_field: string;
  hubspot_property: string;
  direction: 'read' | 'write' | 'bidirectional';
  write_policy: 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';
  valid_values?: { value: string; label: string }[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/field-mappings
 *
 * Returns all field mappings for the current org.
 */
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from('field_mappings')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('canonical_field', { ascending: true });

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/field-mappings' });
      console.error('Failed to get field mappings:', error);
      return NextResponse.json(
        { error: 'Failed to get field mappings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ mappings: data || [] });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/field-mappings' });
    console.error('Failed to get field mappings:', error);
    return NextResponse.json(
      { error: 'Failed to get field mappings' },
      { status: 500 }
    );
  }
}
