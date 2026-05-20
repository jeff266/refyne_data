import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/hubspot/properties-cache
 *
 * Returns cached HubSpot properties from field_mappings auto-config
 * Auth: org:operator or above
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    // Get HubSpot properties from field_mappings table
    // This assumes migration 032 (field_mappings_auto_config) has been applied
    const { data: properties, error } = await supabase
      .from('field_mappings')
      .select('hubspot_property, hubspot_label, hubspot_type, valid_values, calculated')
      .eq('org_id', ctx.orgId)
      .order('hubspot_label');

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/properties-cache' });
      console.error('Failed to get properties cache:', error);
      return NextResponse.json(
        { error: 'Failed to get properties' },
        { status: 500 }
      );
    }

    // Transform to expected format
    const transformed = (properties || []).map((p: any) => ({
      name: p.hubspot_property,
      label: p.hubspot_label || p.hubspot_property,
      type: p.hubspot_type || 'string',
      objectType: 'company', // Could be extended to support contacts
      calculated: p.calculated || false,
      validValues: p.valid_values || null,
    }));

    return NextResponse.json({ properties: transformed });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/properties-cache' });
    console.error('Failed to get properties cache:', error);
    return NextResponse.json(
      { error: 'Failed to get properties' },
      { status: 500 }
    );
  }
}
