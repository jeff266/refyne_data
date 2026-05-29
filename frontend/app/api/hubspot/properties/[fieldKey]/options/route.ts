/**
 * HubSpot Property Options API
 *
 * GET /api/hubspot/properties/[fieldKey]/options
 *
 * Fetches picklist values for an enum field from HubSpot.
 * Used by survivorship rules modal to populate value order editor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

export async function GET(
  request: NextRequest,
  { params }: { params: { fieldKey: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { fieldKey } = params;

  if (!fieldKey) {
    return NextResponse.json({ error: 'Field key is required' }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(ctx.orgId);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'HubSpot connection not found' },
        { status: 404 }
      );
    }

    // Fetch property definition from HubSpot
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/properties/companies/${fieldKey}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        );
      }
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const property = await response.json();

    // Return early if not an enumeration field
    if (property.type !== 'enumeration') {
      return NextResponse.json({
        options: [],
        type: property.type,
        fieldLabel: property.label,
      });
    }

    // Extract and sort options
    const options = (property.options ?? [])
      .filter((o: any) => !o.hidden)
      .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((o: any) => ({
        label: o.label,
        value: o.value,
      }));

    return NextResponse.json({
      options,
      type: 'enumeration',
      fieldLabel: property.label,
    });
  } catch (error) {
    console.error('Error fetching HubSpot property options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property options' },
      { status: 500 }
    );
  }
}
