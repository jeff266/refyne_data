/**
 * Name Registry Export API
 *
 * GET /api/name-registry/export - Export registry entries as CSV (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { buildCSV } from '@/lib/utils/csv';

type Scope = 'org' | 'global';

/**
 * GET /api/name-registry/export
 *
 * Exports registry entries as CSV file.
 * Admin only (requireAdmin).
 *
 * Query params:
 *  - scope: 'org' | 'global' (required)
 *
 * Returns:
 *  - CSV file stream with headers: type, input_token, canonical_form, source, created_at
 *  - Filename: refyne-name-registry-[YYYY-MM-DD].csv
 *  - No pagination - returns all rows for the scope
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') as Scope | null;

    // Validate required scope param
    if (!scope || !['org', 'global'].includes(scope)) {
      return NextResponse.json(
        { error: "Invalid or missing scope. Must be 'org' or 'global'" },
        { status: 400 }
      );
    }

    // Build query based on scope
    let query = supabaseAdmin
      .from('name_registry')
      .select('registry_type, input_token, canonical_form, source, created_at')
      .order('created_at', { ascending: false });

    if (scope === 'org') {
      query = query.eq('org_id', ctx.orgId);
    } else {
      // scope === 'global'
      query = query.is('org_id', null);
    }

    const { data: entries, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry/export' });
      console.error('Failed to fetch registry entries for export:', error);
      return NextResponse.json(
        { error: 'Failed to export registry entries' },
        { status: 500 }
      );
    }

    // Build CSV
    const headers = ['type', 'input_token', 'canonical_form', 'source', 'created_at'];

    const rows = (entries ?? []).map((entry) => [
      entry.registry_type,
      entry.input_token,
      entry.canonical_form,
      entry.source,
      entry.created_at,
    ]);

    const csvContent = buildCSV(headers, rows);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `refyne-name-registry-${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry/export' });
    console.error('Failed to export registry entries:', error);
    return NextResponse.json(
      { error: 'Failed to export registry entries' },
      { status: 500 }
    );
  }
}
