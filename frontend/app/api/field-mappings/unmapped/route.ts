import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/field-mappings/unmapped
 *
 * Returns unmapped HubSpot properties for a portal.
 * Query params:
 * - object_type: Object type (company, contact, deal)
 * - portal_id: Portal ID (required)
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
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const objectType = searchParams.get('object_type') || 'company';
    const portalId = searchParams.get('portal_id');

    if (!portalId) {
      return NextResponse.json({ error: 'portal_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('hubspot_properties_cache')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('portal_id', portalId)
      .eq('object_type', objectType)
      .eq('is_mapped', false)
      .eq('is_custom', true) // Only show custom unmapped properties
      .order('property_name');

    if (error) {
      captureWithOrgContext(error, ctx.orgId, {
        route: '/api/field-mappings/unmapped',
      });
      console.error('Failed to get unmapped properties:', error);
      return NextResponse.json(
        { error: 'Failed to get unmapped properties' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      properties: data || [],
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/field-mappings/unmapped',
    });
    console.error('Failed to get unmapped properties:', error);
    return NextResponse.json(
      { error: 'Failed to get unmapped properties' },
      { status: 500 }
    );
  }
}
