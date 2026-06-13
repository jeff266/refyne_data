import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

// Compliance fields that cannot be deleted
const COMPLIANCE_FIELDS = [
  'HasOptedOutOfEmail',
  'DoNotCall',
  'hs_email_optout',
  'hs_email_bounce',
];

/**
 * PUT /api/dedup/field-exclusions/bulk
 *
 * Bulk replace all custom field exclusions for an org + object type.
 * Protects compliance fields from deletion.
 *
 * Auth: requireAdmin()
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { objectType, exclusions } = body;

    // Validation
    if (!objectType || !['company', 'contact'].includes(objectType)) {
      return NextResponse.json(
        { error: 'Invalid objectType (must be "company" or "contact")' },
        { status: 400 }
      );
    }

    if (!Array.isArray(exclusions)) {
      return NextResponse.json({ error: 'exclusions must be an array' }, { status: 400 });
    }

    // Validate each exclusion
    for (const exclusion of exclusions) {
      if (!exclusion.fieldName) {
        return NextResponse.json({ error: 'Each exclusion must have fieldName' }, { status: 400 });
      }

      if (!['never_merge', 'union_true', 'append'].includes(exclusion.exclusionType)) {
        return NextResponse.json(
          { error: 'Invalid exclusionType (must be never_merge, union_true, or append)' },
          { status: 400 }
        );
      }

      if (
        exclusion.exclusionType === 'append' &&
        exclusion.separator &&
        !['\n', '; ', ', '].includes(exclusion.separator)
      ) {
        return NextResponse.json(
          { error: 'Invalid separator (must be \\n, ; , or , )' },
          { status: 400 }
        );
      }
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Delete all existing custom exclusions (but NOT compliance fields)
    const { error: deleteError } = await supabase
      .from('dedup_field_exclusions')
      .delete()
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .not('field_name', 'in', `(${COMPLIANCE_FIELDS.map((f) => `"${f}"`).join(',')})`);

    if (deleteError) {
      console.error('[Field Exclusions Bulk] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete existing exclusions' }, { status: 500 });
    }

    // If exclusions array is empty, we're done
    if (exclusions.length === 0) {
      // Fetch compliance fields to return
      const { data: complianceFields } = await supabase
        .from('dedup_field_exclusions')
        .select('*')
        .eq('org_id', ctx.orgId)
        .eq('object_type', objectType)
        .in('field_name', COMPLIANCE_FIELDS);

      return NextResponse.json({ exclusions: complianceFields || [] });
    }

    // Upsert exclusions (insert or update if already exists)
    const exclusionsToInsert = exclusions.map((excl) => ({
      org_id: ctx.orgId,
      object_type: objectType,
      field_name: excl.fieldName,
      exclusion_type: excl.exclusionType,
      separator: excl.separator || '\n',
    }));

    const { error: insertError } = await supabase
      .from('dedup_field_exclusions')
      .upsert(exclusionsToInsert, {
        onConflict: 'org_id,object_type,field_name',
      });

    if (insertError) {
      console.error('[Field Exclusions Bulk] Insert error:', insertError);
      return NextResponse.json({
        error: 'Failed to insert exclusions',
        details: insertError.message
      }, { status: 500 });
    }

    // Fetch all exclusions (compliance + custom) to return
    const { data: allExclusions, error: fetchError } = await supabase
      .from('dedup_field_exclusions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .order('field_name', { ascending: true });

    if (fetchError) {
      console.error('[Field Exclusions Bulk] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch exclusions' }, { status: 500 });
    }

    // Mark compliance fields
    const exclusionsWithFlags = (allExclusions || []).map((excl) => ({
      ...excl,
      is_compliance: COMPLIANCE_FIELDS.includes(excl.field_name),
    }));

    return NextResponse.json({ exclusions: exclusionsWithFlags });
  } catch (error) {
    console.error('[Field Exclusions Bulk] Error:', error);
    return NextResponse.json({ error: 'Failed to update field exclusions' }, { status: 500 });
  }
}
