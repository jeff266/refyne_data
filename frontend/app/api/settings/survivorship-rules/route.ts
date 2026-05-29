/**
 * Survivorship Rules API
 *
 * GET  /api/settings/survivorship-rules - List all rules (default + org-specific)
 * POST /api/settings/survivorship-rules - Create new org-specific rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/settings/survivorship-rules
 *
 * Returns all rules for the org (default + org-specific merged).
 * Also returns field options for the Add Rule modal.
 */
export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // TODO: Fetch field options from HubSpot properties API
    // For now, return a static list of common fields
    const fieldOptions = [
      { key: '*', label: 'All fields', type: 'text' },
      { key: 'lifecyclestage', label: 'Lifecycle stage', type: 'enum' },
      { key: 'domain', label: 'Domain', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'industry', label: 'Industry', type: 'text' },
      { key: 'annualrevenue', label: 'Annual revenue', type: 'number' },
      { key: 'numberofemployees', label: 'Number of employees', type: 'number' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'zip', label: 'ZIP code', type: 'text' },
    ];

    return NextResponse.json({
      rules: enrichedRules,
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
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { field_key, rule_type, rule_config } = body;

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
    ];

    if (!validRuleTypes.includes(rule_type)) {
      return NextResponse.json(
        { error: `Invalid rule_type. Must be one of: ${validRuleTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('dedup_survivorship_rules')
      .insert({
        org_id: orgId,
        field_key,
        rule_type,
        rule_config,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating survivorship rule:', error);
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}
