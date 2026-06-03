import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * GET /api/hubspot/properties?objectType=company|contact
 *
 * Returns HubSpot properties for the specified object type.
 * Uses 24-hour cache to avoid hitting HubSpot API on every request.
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const objectType = searchParams.get('objectType') || 'company';

    if (!['company', 'contact'].includes(objectType)) {
      return NextResponse.json(
        { error: 'Invalid objectType. Must be "company" or "contact"' },
        { status: 400 }
      );
    }

    // Check cache first (24-hour TTL)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: cached } = await supabase
      .from('hubspot_properties_cache')
      .select('properties, fetched_at')
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .gte('fetched_at', twentyFourHoursAgo.toISOString())
      .single();

    if (cached) {
      console.log(`[HubSpot Properties] Cache hit for ${objectType}`);
      return NextResponse.json({
        properties: cached.properties,
        cached: true,
        fetchedAt: cached.fetched_at,
      });
    }

    // Cache miss - fetch from HubSpot API
    console.log(`[HubSpot Properties] Cache miss for ${objectType}, fetching from HubSpot`);

    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'HubSpot not connected', notConnected: true },
        { status: 400 }
      );
    }

    // Fetch properties from HubSpot API
    const hubspotObjectType = objectType === 'contact' ? 'contacts' : 'companies';
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/properties/${hubspotObjectType}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[HubSpot Properties] API error: ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch properties from HubSpot' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const properties = data.results || [];

    // Transform to simpler format
    const transformedProperties = properties.map((prop: any) => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      groupName: prop.groupName,
      description: prop.description,
      options: prop.options || [],
      hubspotDefined: prop.hubspotDefined,
    }));

    // Categorize properties
    const standardProperties = transformedProperties.filter((p: any) => p.hubspotDefined);
    const customProperties = transformedProperties.filter((p: any) => !p.hubspotDefined);

    const result = {
      standard: standardProperties,
      custom: customProperties,
    };

    // Store in cache
    await supabase
      .from('hubspot_properties_cache')
      .upsert({
        org_id: ctx.orgId,
        object_type: objectType,
        properties: result,
        fetched_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,object_type',
      });

    console.log(`[HubSpot Properties] Cached ${properties.length} properties for ${objectType}`);

    return NextResponse.json({
      properties: result,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HubSpot Properties] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}
