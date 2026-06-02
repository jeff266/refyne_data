/**
 * GET /api/hubspot/properties/contacts
 *
 * Returns available HubSpot contact properties for field mapping dropdowns.
 * Filters to enumeration, string, and number types only.
 * Sorts standard properties first, then custom.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { HubSpotClient } from '@/lib/hubspot/client';
import { decryptToken } from '@/lib/crypto/token-encryption';

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get HubSpot connection
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('portal_id, access_token')
      .eq('org_id', orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active HubSpot connection found' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = decryptToken(connection.access_token);
    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch contact properties
    const allProperties = await hubspot.request<{
      results: Array<{
        name: string;
        label: string;
        type: string;
        fieldType: string;
      }>;
    }>('/crm/v3/properties/contacts');

    // Filter to relevant types (enumeration, string, number)
    const relevantTypes = ['enumeration', 'string', 'number'];
    const filtered = allProperties.results.filter((p) =>
      relevantTypes.includes(p.type)
    );

    // Sort: standard properties first, then custom
    const sorted = filtered.sort((a, b) => {
      const aIsStandard = !a.name.startsWith('hs_') && !a.name.includes('_');
      const bIsStandard = !b.name.startsWith('hs_') && !b.name.includes('_');

      if (aIsStandard && !bIsStandard) return -1;
      if (!aIsStandard && bIsStandard) return 1;
      return a.label.localeCompare(b.label);
    });

    // Map to simple format
    const properties = sorted.map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type,
    }));

    return NextResponse.json({ properties });
  } catch (error) {
    console.error('[HubSpot Properties] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}
