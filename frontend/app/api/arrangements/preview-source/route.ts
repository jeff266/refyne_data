import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { DEMO_COMPANIES } from '@/lib/arrangements/demo-fixtures';

/**
 * POST /api/arrangements/preview-source
 *
 * Previews records from a source configuration.
 * Returns sample records without executing enrichment.
 * Auth: org:operator or above
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();

    if (!body.source_type || !body.source_config) {
      return NextResponse.json(
        { error: 'Missing source_type or source_config' },
        { status: 400 }
      );
    }

    // For MVP, return demo companies as preview
    // In production, this would fetch from HubSpot lists, CSV, etc.
    const preview = {
      total_count: DEMO_COMPANIES.length,
      sample_records: DEMO_COMPANIES.slice(0, 5),
      source_type: body.source_type,
    };

    return NextResponse.json(preview);

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/preview-source' });
    console.error('Failed to preview source:', error);
    return NextResponse.json(
      { error: 'Failed to preview source' },
      { status: 500 }
    );
  }
}
