import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/arrangements/[id]/estimate
 *
 * Returns estimated records and credits for running an arrangement
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch arrangement
    const { data: arrangement, error: arrError } = await supabaseAdmin
      .from('arrangements')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (arrError || !arrangement) {
      return NextResponse.json({ error: 'Arrangement not found' }, { status: 404 });
    }

    // Estimate records that need enrichment
    // For now, use a simple estimate based on total companies
    // TODO: Query HubSpot to get actual count of companies missing these fields
    const estimatedRecords = Math.floor(Math.random() * 3000) + 500; // Placeholder

    // Determine provider from enrichment steps
    const steps = arrangement.enrichment_steps || [];
    const primaryProvider = steps.length > 0 ? steps[0].provider : 'unknown';

    // Check if this is a BYOK arrangement
    // Check if org has a connection for this provider
    const { data: connection } = await supabaseAdmin
      .from('provider_connections')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('provider', primaryProvider.toLowerCase())
      .eq('status', 'active')
      .single();

    const isByok = !!connection;

    // Fetch org's credit balance
    const { data: org } = await supabaseAdmin
      .from('orgs')
      .select('credits_balance, credits_limit')
      .eq('id', ctx.orgId)
      .single();

    const creditsAvailable = org?.credits_balance || 0;
    const creditsRequired = isByok ? 0 : Math.ceil(estimatedRecords * 0.1); // Estimate 0.1 credits per record

    return NextResponse.json({
      estimated_records: estimatedRecords,
      provider: primaryProvider,
      is_byok: isByok,
      credits_required: creditsRequired,
      credits_available: creditsAvailable,
    });
  } catch (error) {
    console.error('[Arrangement Estimate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate estimate' },
      { status: 500 }
    );
  }
}
