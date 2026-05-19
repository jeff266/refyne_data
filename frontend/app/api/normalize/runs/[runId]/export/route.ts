/**
 * GET /api/normalize/runs/:runId/export
 *
 * Export changes for a normalization run as CSV.
 * Supports same filters as the changes endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const runId = params.runId;
  const searchParams = request.nextUrl.searchParams;

  const field = searchParams.get('field');
  const search = searchParams.get('search');

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    // Build query (no pagination for export)
    let query = supabase
      .from('normalization_changes')
      .select('*')
      .eq('run_id', runId);

    // Apply field filter
    if (field && field !== 'all') {
      query = query.eq('field_name', field);
    }

    // Apply search filter
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,hubspot_company_id.ilike.%${search}%`);
    }

    // Order by company name for better readability
    query = query.order('company_name', { ascending: true });

    const { data: changes, error } = await query;

    if (error) {
      throw error;
    }

    if (!changes || changes.length === 0) {
      return NextResponse.json(
        { error: 'No changes found' },
        { status: 404 }
      );
    }

    // Build CSV
    const headers = [
      'Company Name',
      'Company ID',
      'Field Name',
      'Value Before',
      'Value After',
      'Harmony',
      'Applied At',
    ];

    const rows = changes.map((change: any) => [
      change.company_name || '',
      change.hubspot_company_id,
      change.field_name,
      change.value_before || '',
      change.value_after || '',
      change.harmony_name || '',
      new Date(change.applied_at).toISOString(),
    ]);

    // Escape CSV values
    const escapeCsvValue = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map(row => row.map(v => escapeCsvValue(String(v))).join(',')),
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="normalize-run-${runId.slice(0, 8)}.csv"`,
      },
    });

  } catch (error) {
    console.error('Failed to export changes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
