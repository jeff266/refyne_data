import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { isBetaFeatureEnabled } from '@/lib/features/flags';
import { FEATURE_FLAGS } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/import/status/[session_id]
 * Get import session status and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { session_id: string } }
) {
  // Auth
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Beta gate
  const betaEnabled = await isBetaFeatureEnabled(ctx.orgId, FEATURE_FLAGS.EVENT_LIST_IMPORT);
  if (!betaEnabled) {
    return NextResponse.json({ error: 'feature_not_enabled' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const sessionId = params.session_id;

    // Load import session
    const { data: importSession, error: sessionError } = await supabaseAdmin
      .from('event_imports')
      .select('*')
      .eq('id', sessionId)
      .eq('org_id', ctx.orgId)
      .single();

    if (sessionError || !importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Build response
    return NextResponse.json({
      id: importSession.id,
      status: importSession.status,
      filename: importSession.filename,
      row_count: importSession.row_count,
      matched_count: importSession.matched_count,
      created_count: importSession.created_count,
      updated_count: importSession.updated_count,
      skipped_count: importSession.skipped_count,
      match_summary: importSession.match_summary,
      hubspot_list_id: importSession.hubspot_list_id,
      created_at: importSession.created_at,
      updated_at: importSession.updated_at,
    });
  } catch (error) {
    console.error('[Import Status] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to get import status' }, { status: 500 });
  }
}
