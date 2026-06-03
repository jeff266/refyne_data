/**
 * POST /api/taxonomy/suggestions/[harmonyId]/scan
 *
 * Triggers runTaxonomySuggester for this harmony as a background job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { enqueueTaxonomySuggestionScan } from '@/lib/queue/taxonomy-suggestion-queue';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function POST(
  req: NextRequest,
  { params }: { params: { harmonyId: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const orgId = ctx.orgId;

    // Get harmony details
    const { data: harmony, error: harmonyError } = await supabaseAdmin
      .from('harmonies')
      .select('id, name, source_field, object_type, connection_id, portal_id')
      .eq('id', params.harmonyId)
      .eq('org_id', orgId)
      .single();

    if (harmonyError || !harmony) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    // Enqueue scan job
    const jobId = await enqueueTaxonomySuggestionScan({
      orgId,
      harmonyId: harmony.id,
      hubspotProperty: harmony.source_field,
      objectType: harmony.object_type as 'company' | 'contact',
      harmonyContext: harmony.name,
      portalId: harmony.portal_id,
      connectionId: harmony.connection_id,
    });

    if (!jobId) {
      return NextResponse.json({ error: 'Failed to enqueue scan' }, { status: 500 });
    }

    return NextResponse.json({ jobId, queued: true });
  } catch (error) {
    console.error(`[POST /api/taxonomy/suggestions/${params.harmonyId}/scan] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to trigger scan' },
      { status: 500 }
    );
  }
}
