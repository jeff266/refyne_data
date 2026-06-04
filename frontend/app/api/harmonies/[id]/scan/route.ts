import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { scanHubSpotField } from '@/lib/hubspot/harmony-field-scanner';
import { getFieldAssignments } from '@/lib/harmonies/field-assignments';
import { enqueueHarmonyScan } from '@/lib/queue/harmony-scan-queue';
import { HubSpotClient } from '@/lib/hubspot/client';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/harmonies/[id]/scan
 *
 * Start a field scan job
 */
export async function POST(request: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const harmonyId = context.params.id;

  try {
    // Get harmony details (include preset harmonies with org_id IS NULL)
    const { data: harmony, error: harmonyError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('id', harmonyId)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
      .single();

    if (harmonyError || !harmony) {
      console.error('[Scan Job] Harmony not found:', { harmonyId, orgId: ctx.orgId, error: harmonyError });
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    // Get HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (connError || !connection) {
      console.error('[Scan Job] HubSpot connection not found:', { orgId: ctx.orgId, error: connError });
      return NextResponse.json(
        { error: 'HubSpot connection not found. Please connect HubSpot in Settings.' },
        { status: 400 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      console.error('[Scan Job] Failed to get access token:', { orgId: ctx.orgId });
      return NextResponse.json(
        { error: 'Failed to authenticate with HubSpot. Please reconnect in Settings.' },
        { status: 500 }
      );
    }

    // Get HubSpot property name
    // For custom harmonies, use harmony.field directly (it's already the HubSpot property)
    // For preset harmonies, try to find field assignment
    let hubspotProperty = harmony.field;

    if (harmony.is_preset) {
      const fieldAssignments = await getFieldAssignments(
        ctx.orgId,
        harmony.object_type as 'company' | 'contact' | 'deal'
      );
      const assignment = fieldAssignments.find(a => a.harmonyId === harmonyId);

      if (assignment) {
        hubspotProperty = assignment.hubspotProperty;
      }
    }

    if (!hubspotProperty) {
      console.error('[Scan Job] No field configured:', { harmonyId, isPreset: harmony.is_preset, field: harmony.field });
      return NextResponse.json(
        { error: 'No field configured for this harmony' },
        { status: 400 }
      );
    }

    // Map object type to HubSpot API format (validate before creating job)
    let apiObjectType: 'companies' | 'contacts';
    if (harmony.object_type === 'company') {
      apiObjectType = 'companies';
    } else if (harmony.object_type === 'contact') {
      apiObjectType = 'contacts';
    } else {
      console.error('[Scan Job] Unsupported object type:', harmony.object_type);
      return NextResponse.json(
        { error: `Unsupported object type: ${harmony.object_type}` },
        { status: 400 }
      );
    }

    console.log('[Scan Job] Starting scan:', {
      harmonyId,
      harmonyName: harmony.name,
      objectType: harmony.object_type,
      apiObjectType,
      hubspotProperty,
      isPreset: harmony.is_preset,
    });

    // Create scan job
    const { data: job, error: jobError } = await supabase
      .from('harmony_scan_jobs')
      .insert({
        harmony_id: harmonyId,
        org_id: ctx.orgId,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single();

    if (jobError) {
      captureWithOrgContext(jobError, ctx.orgId, { route: `/api/harmonies/${harmonyId}/scan` });
      console.error('[Scan Job] Failed to create:', jobError);
      return NextResponse.json({ error: 'Failed to create scan job' }, { status: 500 });
    }

    // Check if connection has crm.export scope for Export API
    const hasExportScope = connection.oauth_scopes?.includes('crm.export') ?? false;

    // Try to enqueue the scan job to BullMQ worker
    const bullmqJobId = await enqueueHarmonyScan({
      jobId: job.id,
      orgId: ctx.orgId,
      portalId: connection.portal_id,
      accessToken,
      objectType: apiObjectType,
      fieldName: hubspotProperty,
      harmonyId,
      hasExportScope,
    });

    // If queue is available, return immediately
    if (bullmqJobId) {
      console.log(`[Scan Job] Enqueued to BullMQ worker (job ${bullmqJobId})`);
      return NextResponse.json({ jobId: job.id, success: true });
    }

    // Fallback: Run scan synchronously in serverless function (will timeout for large datasets)
    console.warn('[Scan Job] BullMQ queue not available, falling back to synchronous scan');
    performScan(job.id, {
      orgId: ctx.orgId,
      portalId: connection.portal_id,
      accessToken,
      objectType: apiObjectType,
      fieldName: hubspotProperty,
      hasExportScope,
    }).catch((err) => {
      console.error('[Scan Job] Background scan failed:', err);
      captureWithOrgContext(err, ctx.orgId, { jobId: job.id });
    });

    return NextResponse.json({ jobId: job.id, success: true });
  } catch (error: any) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/harmonies/${harmonyId}/scan` });
    console.error('[Scan Job] Unexpected error:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to start scan: ${errorMessage}` },
      { status: 500 }
    );
  }
}

async function performScan(
  jobId: string,
  options: {
    orgId: string;
    portalId: string;
    accessToken: string;
    objectType: 'companies' | 'contacts';
    fieldName: string;
    hasExportScope?: boolean;
  }
) {
  if (!supabase) {
    console.error('[Scan Job] Supabase not configured');
    return;
  }

  const db = supabase; // Capture for TypeScript

  try {
    // Update job status to scanning
    await db
      .from('harmony_scan_jobs')
      .update({
        status: 'scanning',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Create HubSpot client
    const client = new HubSpotClient(options.accessToken, options.portalId);

    // Perform scan
    const distinctValues = await scanHubSpotField({
      client,
      objectType: options.objectType === 'companies' ? 'company' : 'contact',
      fieldName: options.fieldName,
      hasExportScope: options.hasExportScope,
      onProgress: async (progress, totalRecords) => {
        await db
          .from('harmony_scan_jobs')
          .update({
            progress,
            total_records: totalRecords,
          })
          .eq('id', jobId);
      },
    });

    // Update job with results
    await db
      .from('harmony_scan_jobs')
      .update({
        status: 'completed',
        progress: 100,
        distinct_values: distinctValues,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (error: any) {
    console.error('[Scan Job] Scan failed:', error);

    // Update job with error
    await db
      .from('harmony_scan_jobs')
      .update({
        status: 'failed',
        error_message: error?.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
