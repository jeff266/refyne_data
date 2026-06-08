import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { isBetaFeatureEnabled } from '@/lib/features/flags';
import { FEATURE_FLAGS } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/db/admin-client';
import Papa from 'papaparse';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10000;

type ColumnType = 'email' | 'linkedin' | 'name' | 'title' | 'company' | 'location' | 'text';

interface ColumnMetadata {
  name: string;
  type: ColumnType;
  sample_values: string[];
  null_count: number;
  unique_count: number;
}

/**
 * POST /api/import/parse
 * Parse CSV file and create import session
 */
export async function POST(request: NextRequest) {
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
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      console.error('[Import Parse] CSV parse errors:', parseResult.errors);
      return NextResponse.json({ error: 'Failed to parse CSV file' }, { status: 400 });
    }

    const rows = parseResult.data as Array<Record<string, string>>;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `File has ${rows.length} rows. Max ${MAX_ROWS} per import` },
        { status: 400 }
      );
    }

    // Detect column types
    const columns = detectColumnTypes(rows, parseResult.meta.fields || []);

    // Validate: email column required
    const hasEmailColumn = columns.some((col) => col.type === 'email');
    if (!hasEmailColumn) {
      return NextResponse.json(
        { error: 'No email column detected. Email is required for matching.' },
        { status: 400 }
      );
    }

    // Create import session
    const { data: importSession, error: importError } = await supabaseAdmin
      .from('event_imports')
      .insert({
        org_id: ctx.orgId,
        filename: file.name,
        status: 'parsed',
        initiated_by: ctx.userId,
        row_count: rows.length,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (importError || !importSession) {
      console.error('[Import Parse] Failed to create import session:', importError);
      return NextResponse.json({ error: 'Failed to create import session' }, { status: 500 });
    }

    // Insert rows
    const rowsToInsert = rows.map((row, index) => ({
      import_id: importSession.id,
      row_index: index,
      raw_data: row,
      created_at: new Date().toISOString(),
    }));

    // Insert in batches of 1000
    for (let i = 0; i < rowsToInsert.length; i += 1000) {
      const batch = rowsToInsert.slice(i, i + 1000);
      const { error: rowsError } = await supabaseAdmin.from('event_import_rows').insert(batch);

      if (rowsError) {
        console.error('[Import Parse] Failed to insert rows:', rowsError);
        // Clean up import session
        await supabaseAdmin.from('event_imports').delete().eq('id', importSession.id);
        return NextResponse.json({ error: 'Failed to save import data' }, { status: 500 });
      }
    }

    // Return response with all rows for client-side filtering
    // (Max 10,000 rows enforced above, so safe to return all)
    return NextResponse.json({
      session_id: importSession.id,
      row_count: rows.length,
      columns,
      preview_rows: rows, // Return all rows for accurate filter counts
    });
  } catch (error) {
    console.error('[Import Parse] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}

/**
 * Detect column types from CSV data
 */
function detectColumnTypes(rows: Array<Record<string, string>>, fields: string[]): ColumnMetadata[] {
  return fields.map((field) => {
    const values = rows.map((row) => row[field]).filter((v) => v != null && v !== '');
    const uniqueValues = new Set(values);

    // Detect type
    let type: ColumnType = 'text';

    const lowerName = field.toLowerCase();

    // Email detection
    if (lowerName.includes('email')) {
      type = 'email';
    } else {
      const emailMatches = values.filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      if (emailMatches.length / values.length > 0.8) {
        type = 'email';
      }
    }

    // LinkedIn detection
    if (lowerName.includes('linkedin')) {
      type = 'linkedin';
    } else if (type !== 'email') {
      const linkedInMatches = values.filter((v) => /linkedin\.com\/in\//i.test(v));
      if (linkedInMatches.length / values.length > 0.8) {
        type = 'linkedin';
      }
    }

    // Name detection
    if (
      type === 'text' &&
      (lowerName.includes('first') ||
        lowerName.includes('last') ||
        lowerName.includes('full') ||
        lowerName === 'name')
    ) {
      type = 'name';
    }

    // Title detection
    if (
      type === 'text' &&
      (lowerName.includes('title') || lowerName.includes('role') || lowerName.includes('position'))
    ) {
      type = 'title';
    }

    // Company detection
    if (
      type === 'text' &&
      (lowerName.includes('company') ||
        lowerName.includes('organization') ||
        lowerName.includes('employer'))
    ) {
      type = 'company';
    }

    // Location detection
    if (
      type === 'text' &&
      (lowerName.includes('location') ||
        lowerName.includes('city') ||
        lowerName.includes('state') ||
        lowerName.includes('country'))
    ) {
      type = 'location';
    }

    return {
      name: field,
      type,
      sample_values: Array.from(uniqueValues).slice(0, 5),
      null_count: rows.length - values.length,
      unique_count: uniqueValues.size,
    };
  });
}
