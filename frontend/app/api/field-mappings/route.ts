import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { transformArray } from '@/lib/utils/transform';

export interface FieldMapping {
  id: string;
  orgId: string;
  canonicalField: string;
  hubspotProperty: string;
  direction: 'read' | 'write' | 'bidirectional';
  writePolicy: 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';
  validValues?: { value: string; label: string }[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/field-mappings
 *
 * Returns all field mappings for the current org.
 * Query params:
 * - object_type: Filter by object type (company, contact, deal)
 * - portal_id: Filter by portal ID
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

    const { searchParams } = new URL(request.url);
    const objectType = searchParams.get('object_type') || 'company';
    const portalId = searchParams.get('portal_id');

    let query = supabase
      .from('field_mappings')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType);

    if (portalId) {
      query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
    }

    const { data, error } = await query.order('is_system', { ascending: false }).order('canonical_field', { ascending: true });

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/field-mappings' });
      console.error('Failed to get field mappings:', error);
      return NextResponse.json(
        { error: 'Failed to get field mappings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mappings: transformArray<FieldMapping>(data || []),
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/field-mappings' });
    console.error('Failed to get field mappings:', error);
    return NextResponse.json(
      { error: 'Failed to get field mappings' },
      { status: 500 }
    );
  }
}
