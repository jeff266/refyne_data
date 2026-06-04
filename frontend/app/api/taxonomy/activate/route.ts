/**
 * POST /api/taxonomy/activate
 *
 * Activates a taxonomy pack OR field-read values by copying entries to harmony_reference_data.
 *
 * Two modes:
 * 1. Pack mode: packId provided → copies pack entries
 * 2. Field mode: canonicalValues provided → creates self-mappings from HubSpot field values
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { enqueueTaxonomySuggestionScan } from '@/lib/queue/taxonomy-suggestion-queue';

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const orgId = ctx.orgId;

    const body = await req.json();
    const { packId, canonicalValues, harmonyId, targetField, writePolicy, objectType } = body;

    // Validate that either packId or canonicalValues is provided
    if (!packId && !canonicalValues) {
      return NextResponse.json(
        { error: 'Either packId or canonicalValues is required' },
        { status: 400 }
      );
    }

    // Branch 1: Pack-based activation (existing flow)
    if (packId) {
      // Get pack entries
      const { data: entries, error: entriesError } = await supabaseAdmin
        .from('sub_industry_pack_entries')
        .select('*')
        .eq('pack_id', packId);

      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) {
        return NextResponse.json({ error: 'Pack has no entries' }, { status: 400 });
      }

      // Copy entries to harmony_reference_data
      const refDataRows = entries.map((entry) => ({
        table_name: harmonyId || packId,
        input_value: entry.input_value,
        canonical_value: entry.canonical_value,
        org_id: orgId,
        pack_id: packId,
        naics_code: entry.naics_code,
        source: 'pack',
      }));

      const { error: insertError } = await supabaseAdmin
        .from('harmony_reference_data')
        .upsert(refDataRows, {
          onConflict: 'table_name,org_id,input_value',
          ignoreDuplicates: false,
        });

      if (insertError) throw insertError;

      return NextResponse.json({
        harmonyId: harmonyId || packId,
        entriesCopied: entries.length,
        success: true,
      });
    }

    // Branch 2: Field-based activation (NEW - HubSpot field read flow)
    else if (canonicalValues && Array.isArray(canonicalValues)) {
      if (!harmonyId) {
        return NextResponse.json(
          { error: 'harmonyId is required for field-based activation' },
          { status: 400 }
        );
      }

      // Create self-mappings (input_value = canonical_value)
      const refDataRows = canonicalValues.map((canonical: string) => ({
        table_name: harmonyId,
        input_value: canonical,
        canonical_value: canonical,
        org_id: orgId,
        source: 'hubspot_read',
        is_active: true,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('harmony_reference_data')
        .upsert(refDataRows, {
          onConflict: 'table_name,org_id,input_value',
          ignoreDuplicates: false,
        });

      if (insertError) throw insertError;

      // Get HubSpot connection details for suggestion scan
      const { data: connection } = await supabaseAdmin
        .from('hubspot_connections')
        .select('portal_id, id')
        .eq('org_id', orgId)
        .eq('connection_status', 'active')
        .single();

      // Trigger suggestion scan immediately (if Redis configured)
      let scanQueued = false;
      if (connection && targetField) {
        try {
          const jobId = await enqueueTaxonomySuggestionScan({
            orgId,
            harmonyId,
            hubspotProperty: targetField,
            objectType: objectType || 'company',
            harmonyContext: harmonyId,
            portalId: connection.portal_id,
            connectionId: connection.id,
          });

          scanQueued = !!jobId;
          console.log(`[taxonomy/activate] Enqueued suggestion scan: ${jobId}`);
        } catch (error) {
          console.error('[taxonomy/activate] Failed to enqueue suggestion scan:', error);
          // Don't fail activation if scan fails - just log it
        }
      }

      return NextResponse.json({
        harmonyId,
        entriesCopied: refDataRows.length,
        success: true,
        scanQueued,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request - neither packId nor canonicalValues provided correctly' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST /api/taxonomy/activate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to activate taxonomy' },
      { status: 500 }
    );
  }
}
