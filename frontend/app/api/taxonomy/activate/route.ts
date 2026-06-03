/**
 * POST /api/taxonomy/activate
 *
 * Activates a taxonomy pack by copying entries to harmony_reference_data
 * and creating/updating the harmony.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

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
    const { packId, harmonyId, targetField, writePolicy } = body;

    if (!packId) {
      return NextResponse.json({ error: 'packId required' }, { status: 400 });
    }

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
  } catch (error) {
    console.error('[POST /api/taxonomy/activate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to activate taxonomy pack' },
      { status: 500 }
    );
  }
}
