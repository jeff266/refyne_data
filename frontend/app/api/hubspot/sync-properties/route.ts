import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * POST /api/hubspot/sync-properties
 *
 * Syncs HubSpot properties schema to field_mappings table
 * Auth: org:operator or above
 */
export async function POST(request: NextRequest) {
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

    // Get HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_oauth_tokens')
      .select('access_token')
      .eq('org_id', ctx.orgId)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    // Fetch properties from HubSpot
    const companyPropsRes = await fetch(
      'https://api.hubapi.com/crm/v3/properties/companies',
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!companyPropsRes.ok) {
      throw new Error('Failed to fetch properties from HubSpot');
    }

    const { results: companyProps } = await companyPropsRes.json();

    // Upsert to field_mappings table
    const mappings = companyProps
      .filter((p: any) => !p.calculated && !p.readOnlyValue) // Exclude calculated/read-only
      .map((p: any) => ({
        org_id: ctx.orgId,
        hubspot_property: p.name,
        hubspot_label: p.label,
        hubspot_type: p.type,
        valid_values: p.options ? p.options.map((o: any) => ({ value: o.value, label: o.label })) : null,
        calculated: false,
        created_at: new Date().toISOString(),
      }));

    // Batch upsert
    const { error: upsertError } = await supabase
      .from('field_mappings')
      .upsert(mappings, {
        onConflict: 'org_id,hubspot_property',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      captureWithOrgContext(upsertError, ctx.orgId, { route: '/api/hubspot/sync-properties' });
      console.error('Failed to upsert properties:', upsertError);
      return NextResponse.json(
        { error: 'Failed to sync properties' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      synced: mappings.length,
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/sync-properties' });
    console.error('Failed to sync properties:', error);
    return NextResponse.json(
      { error: 'Failed to sync properties' },
      { status: 500 }
    );
  }
}
