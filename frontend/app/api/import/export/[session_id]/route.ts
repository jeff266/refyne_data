import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { isBetaFeatureEnabled } from '@/lib/features/flags';
import { FEATURE_FLAGS } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/import/export/[session_id]
 * Export import session as CSV with match metadata
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

  requireAdmin(ctx.orgRole);

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

    // Load all rows
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('event_import_rows')
      .select('*')
      .eq('import_id', sessionId)
      .order('row_index');

    if (rowsError || !rows) {
      return NextResponse.json({ error: 'Failed to load import rows' }, { status: 500 });
    }

    // Build CSV
    const headers = [
      'Row Index',
      'Email',
      'First Name',
      'Last Name',
      'Company',
      'Job Title',
      'Bucket',
      'Match Type',
      'Match Confidence',
      'HubSpot Contact ID',
      'HubSpot Company ID',
      'Owner ID',
      'Review Reason',
    ];

    const csvRows = rows.map((row) => {
      const rawData = row.raw_data as Record<string, string>;
      return [
        row.row_index,
        rawData.email || '',
        row.cleaned_first_name || rawData.first_name || '',
        row.cleaned_last_name || rawData.last_name || '',
        rawData.company || '',
        rawData.job_title || '',
        row.bucket || '',
        row.match_type || '',
        row.match_confidence || '',
        row.hubspot_contact_id || '',
        row.hubspot_company_id || '',
        row.owner_id || '',
        row.review_reason || '',
      ].map((cell) => {
        // Escape CSV values
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
    });

    const csv = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');

    // Return as downloadable CSV
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="import-${sessionId}-export.csv"`,
      },
    });
  } catch (error) {
    console.error('[Import Export] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to export import data' }, { status: 500 });
  }
}
