/**
 * POST /api/taxonomy/read-field-values
 *
 * Fetches all records for a given objectType and property,
 * counts distinct values, sorts by frequency, and flags suspects (count < 3).
 *
 * Used in Taxonomy Wizard Screen 3 "Read from HubSpot field" flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { HubSpotClient } from '@/lib/hubspot/client';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {

    // 2. Parse request
    const { hubspotProperty, objectType } = await request.json();

    if (!hubspotProperty || !objectType) {
      return NextResponse.json(
        { error: 'hubspotProperty and objectType are required' },
        { status: 400 }
      );
    }

    if (objectType !== 'company' && objectType !== 'contact') {
      return NextResponse.json(
        { error: 'objectType must be "company" or "contact"' },
        { status: 400 }
      );
    }

    // 3. Get HubSpot connection for this org
    const { data: connection, error: connError } = await supabaseAdmin
      .from('hubspot_connections')
      .select('access_token, portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No active HubSpot connection found' },
        { status: 404 }
      );
    }

    const client = new HubSpotClient(connection.access_token, connection.portal_id);

    // 4. Fetch all records with this property and count occurrences
    const valueCounts = new Map<string, number>();
    let totalRecords = 0;
    let blankCount = 0;

    console.log(`[read-field-values] Fetching ${objectType} records with property: ${hubspotProperty}`);

    for await (const batch of client.getAllRecords(objectType, [hubspotProperty])) {
      for (const record of batch) {
        totalRecords++;
        const val = record.properties?.[hubspotProperty]?.trim();

        if (!val) {
          blankCount++;
          continue;
        }

        valueCounts.set(val, (valueCounts.get(val) ?? 0) + 1);
      }
    }

    console.log(`[read-field-values] Scanned ${totalRecords} ${objectType}s, found ${valueCounts.size} distinct values`);

    // 5. Sort by count descending and mark suspects
    const values = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({
        value,
        count,
        isBlank: false,
        isSuspect: count < 3,
      }));

    // 6. Return response
    return NextResponse.json({
      values,
      totalRecords,
      blankCount,
      uniqueValueCount: values.length,
    });
  } catch (error) {
    console.error('[POST /api/taxonomy/read-field-values] Error:', error);
    return NextResponse.json(
      { error: 'Failed to read field values from HubSpot' },
      { status: 500 }
    );
  }
}
