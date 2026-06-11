/**
 * Survivorship Rules API
 *
 * GET  /api/settings/survivorship-rules - List all rules (default + org-specific)
 * POST /api/settings/survivorship-rules - Create new org-specific rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/settings/survivorship-rules
 *
 * Returns all rules for the org (default + org-specific merged).
 * Also returns field options for the Add Rule modal.
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const orgId = ctx.orgId;

  // Read objectType from query params, default to 'companies'
  const objectType = request.nextUrl.searchParams.get('objectType') || 'companies';

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Load rules for this org (defaults + org-specific)
    const { data: rules, error } = await supabase
      .from('dedup_survivorship_rules')
      .select('*')
      .in('org_id', ['__default__', orgId])
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Mark default vs org-specific rules
    const enrichedRules = (rules ?? []).map((rule) => ({
      ...rule,
      is_default: rule.org_id === '__default__',
    }));

    // Fetch field options from HubSpot properties API
    let fieldOptions = [{ key: '*', label: 'All fields', type: 'text' }];

    try {
      const accessToken = await getAccessToken(orgId);

      if (accessToken) {
        const hubspotObjectType = objectType === 'contact' ? 'contacts' : 'companies';
        const response = await fetch(`https://api.hubapi.com/crm/v3/properties/${hubspotObjectType}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const hubspotFields = (data.results || [])
            .filter((prop: any) => !prop.name.startsWith('hs_')) // Filter out internal HubSpot fields
            .map((prop: any) => ({
              key: prop.name,
              label: prop.label || prop.name,
              type:
                prop.type === 'enumeration'
                  ? 'enum'
                  : prop.type === 'number'
                  ? 'number'
                  : prop.type === 'date' || prop.type === 'datetime'
                  ? 'date'
                  : 'text',
            }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label)); // Sort alphabetically

          fieldOptions = [
            { key: '*', label: 'All fields', type: 'text' },
            ...hubspotFields,
          ];
        }
      }
    } catch (err) {
      console.error('Failed to fetch HubSpot properties:', err);
      // Fall back to basic list if HubSpot fetch fails
    }

    // Filter default rules based on object type
    // When objectType === 'contact', exclude company-only default rules
    // Keep: prefer_nonempty (*), source_preference (*)
    // Exclude: never_downgrade (lifecyclestage), tld_disqualifier (domain)
    const COMPANY_ONLY_RULE_TYPES = ['never_downgrade', 'tld_disqualifier'];

    const defaultRules = enrichedRules.filter((r) => r.is_default);
    const orgRules = enrichedRules.filter((r) => !r.is_default);

    const filteredDefaultRules = objectType === 'contact'
      ? defaultRules.filter(r => !COMPANY_ONLY_RULE_TYPES.includes(r.rule_type))
      : defaultRules;

    const filteredRules = [...filteredDefaultRules, ...orgRules];

    return NextResponse.json({
      rules: filteredRules,
      field_options: fieldOptions,
    });
  } catch (error) {
    console.error('Error fetching survivorship rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/survivorship-rules
 *
 * Create a new org-specific survivorship rule.
 */
export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const orgId = ctx.orgId;

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { field_key, rule_type, rule_config } = body;

    console.log('[POST survivorship-rules] Request body:', JSON.stringify(body, null, 2));

    if (!field_key || !rule_type || !rule_config) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate rule_type
    const validRuleTypes = [
      'most_recent',
      'source_preference',
      'never_downgrade',
      'prefer_nonempty',
      'tld_disqualifier',
      'specific_value',
      'rollup',
    ];

    if (!validRuleTypes.includes(rule_type)) {
      return NextResponse.json(
        { error: `Invalid rule_type. Must be one of: ${validRuleTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the highest priority for this org to assign next priority
    const { data: existingRules } = await supabase
      .from('dedup_survivorship_rules')
      .select('priority')
      .eq('org_id', orgId)
      .order('priority', { ascending: false })
      .limit(1);

    const nextPriority = existingRules && existingRules.length > 0 && existingRules[0].priority
      ? existingRules[0].priority + 1
      : 1;

    const { data, error } = await supabase
      .from('dedup_survivorship_rules')
      .insert({
        org_id: orgId,
        field_key,
        rule_type,
        rule_config,
        is_active: true,
        priority: nextPriority,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating survivorship rule:', error);
      return NextResponse.json(
        { error: error.message || 'Database error creating rule' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating survivorship rule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create rule';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
