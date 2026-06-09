import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

const VALID_BUCKETS = [
  'customer',
  'open_deal',
  'former_customer',
  'known_contact',
  'new_contact',
  'needs_review',
];

/**
 * GET /api/import/[session_id]/bucket/[bucket]/export
 *
 * Export contacts from a specific bucket as CSV
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { session_id: string; bucket: string } }
) {
  // Auth
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { session_id, bucket } = params;

  // Validate bucket
  if (!VALID_BUCKETS.includes(bucket)) {
    return NextResponse.json(
      { error: `Invalid bucket. Must be one of: ${VALID_BUCKETS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    // Verify session belongs to org
    const { data: importSession, error: sessionError } = await supabaseAdmin
      .from('event_imports')
      .select('id, org_id')
      .eq('id', session_id)
      .eq('org_id', ctx.orgId)
      .single();

    if (sessionError || !importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Fetch rows for this bucket
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('event_import_rows')
      .select('*')
      .eq('import_id', session_id)
      .eq('bucket', bucket)
      .order('row_index');

    if (rowsError) {
      console.error('[Bucket Export] Failed to fetch rows:', rowsError);
      return NextResponse.json({ error: 'Failed to fetch bucket data' }, { status: 500 });
    }

    // Generate CSV
    const csvRows: string[] = [];

    // Header
    csvRows.push(
      'first_name,last_name,email,company,job_title,match_type,match_confidence,review_reason,hubspot_contact_id'
    );

    // Data rows
    for (const row of rows || []) {
      const rawData = row.raw_data as Record<string, string>;
      const fields = [
        row.cleaned_first_name || '',
        row.cleaned_last_name || '',
        rawData.email || '',
        rawData.company || '',
        rawData.job_title || rawData.title || '',
        row.match_type || '',
        row.match_confidence?.toString() || '',
        row.review_reason || '',
        row.hubspot_contact_id || '',
      ];

      // Escape fields and quote if needed
      const escapedFields = fields.map((field) => {
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });

      csvRows.push(escapedFields.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `refyne-import-${bucket}-${date}.csv`;

    // Return CSV response
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[Bucket Export] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to export bucket' }, { status: 500 });
  }
}
