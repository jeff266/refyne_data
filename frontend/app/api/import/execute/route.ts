import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { isBetaFeatureEnabled } from '@/lib/features/flags';
import { FEATURE_FLAGS } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { importQueue } from '@/lib/queue/import-queue';
import { assignOwners, groupByCompany, type ParsedRow } from '@/lib/import/matcher';

interface WriteConfig {
  update_customers: boolean;
  create_new_contacts: boolean;
  update_known_contacts: boolean;
  skip_needs_review: boolean;
}

interface OwnerAssignment {
  enabled: boolean;
  owners: Array<{ id: string; weight: number }>;
}

/**
 * POST /api/import/execute
 * Enqueue import job for HubSpot sync
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
    const body = await request.json();
    const { session_id, write_config, hubspot_list, owner_assignment } = body as {
      session_id: string;
      write_config: WriteConfig;
      hubspot_list?: { enabled: boolean; list_name: string; buckets: string[] };
      owner_assignment?: OwnerAssignment;
    };

    if (!session_id || !write_config) {
      return NextResponse.json(
        { error: 'session_id and write_config required' },
        { status: 400 }
      );
    }

    // Load import session
    const { data: importSession, error: sessionError } = await supabaseAdmin
      .from('event_imports')
      .select('*')
      .eq('id', session_id)
      .eq('org_id', ctx.orgId)
      .single();

    if (sessionError || !importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Validate session is matched
    if (importSession.status !== 'matched') {
      return NextResponse.json(
        { error: 'Import session must be matched before executing' },
        { status: 400 }
      );
    }

    // Run owner assignment if enabled
    let ownerAssignmentResult: Record<string, string> | null = null;
    if (owner_assignment?.enabled && owner_assignment.owners.length > 0) {
      console.log('[Import Execute] Running owner assignment...');

      // Load matched rows
      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('event_import_rows')
        .select('*')
        .eq('import_id', session_id)
        .order('row_index');

      if (rowsError || !rows) {
        return NextResponse.json({ error: 'Failed to load import rows' }, { status: 500 });
      }

      // Parse rows for grouping
      const parsedRows: ParsedRow[] = rows.map((row) => ({
        email: row.cleaned_first_name && row.cleaned_last_name
          ? `${row.cleaned_first_name.toLowerCase()}@${row.email_domain || 'unknown'}`
          : row.raw_data?.email || '',
        first_name: row.cleaned_first_name,
        last_name: row.cleaned_last_name,
        company: row.raw_data?.company,
      }));

      // Group by company
      const companyGroups = groupByCompany(parsedRows);

      // Assign owners
      const assignments = assignOwners(companyGroups, owner_assignment.owners);

      // Update rows with owner_id
      const updatePromises: any[] = [];
      for (const [companyKey, ownerId] of Array.from(assignments)) {
        const contactsInGroup = companyGroups.get(companyKey) || [];

        for (let i = 0; i < contactsInGroup.length; i++) {
          const contact = contactsInGroup[i];
          const rowIndex = parsedRows.findIndex(
            (r) => r.email === contact.email && r.first_name === contact.first_name
          );

          if (rowIndex >= 0 && rows[rowIndex]) {
            const promise = supabaseAdmin
              .from('event_import_rows')
              .update({
                owner_id: ownerId,
                company_group_key: companyKey,
                updated_at: new Date().toISOString(),
              })
              .eq('id', rows[rowIndex].id);
            updatePromises.push(promise);
          }
        }
      }

      await Promise.all(updatePromises);

      // Build assignment result map
      ownerAssignmentResult = Object.fromEntries(assignments);
      console.log(`[Import Execute] Assigned owners to ${assignments.size} company groups`);
    }

    // Enqueue BullMQ job
    console.log('[Import Execute] Enqueueing import job...');
    const job = await importQueue.add('event-list-import', {
      importId: session_id,
      orgId: ctx.orgId,
      writeConfig: write_config,
      hubspotList: hubspot_list,
      ownerAssignment: ownerAssignmentResult,
    });

    // Update import session
    await supabaseAdmin
      .from('event_imports')
      .update({
        status: 'running',
        write_config,
        owner_assignment: ownerAssignmentResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    console.log(`[Import Execute] Job ${job.id} enqueued for import ${session_id}`);

    return NextResponse.json({
      job_id: job.id,
      import_id: session_id,
    });
  } catch (error) {
    console.error('[Import Execute] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to execute import' }, { status: 500 });
  }
}
