/**
 * Seed Field Mappings API
 *
 * POST /api/field-mappings/seed
 *
 * Seeds default field mappings for the current org's connected HubSpot portal.
 * Can be called manually to fix orgs that connected before auto-seeding was added.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireAdmin } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { seedFieldMappings } from '@/lib/field-mappings/auto-configure';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
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

    // Get active HubSpot connection
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active HubSpot connection found' },
        { status: 400 }
      );
    }

    // Check if field mappings already exist
    const { data: existingMappings } = await supabase
      .from('field_mappings')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('portal_id', connection.portal_id)
      .eq('is_system', true)
      .limit(1);

    if (existingMappings && existingMappings.length > 0) {
      return NextResponse.json({
        message: 'Field mappings already exist for this org',
        alreadySeeded: true,
      });
    }

    // Get valid access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to get HubSpot access token' },
        { status: 500 }
      );
    }

    // Seed field mappings
    const result = await seedFieldMappings(
      ctx.orgId,
      connection.portal_id,
      accessToken
    );

    return NextResponse.json({
      message: 'Field mappings seeded successfully',
      systemMappingsCreated: result.systemMappingsCreated,
      propertiesCached: result.propertiesCached,
    });
  } catch (error) {
    console.error('[Seed Field Mappings] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed field mappings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
