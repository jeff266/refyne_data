import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { scanHubSpotField } from '@/lib/hubspot/harmony-field-scanner';

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
    // Get harmony details
    const { data: harmony, error: harmonyError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('id', harmonyId)
      .eq('org_id', ctx.orgId)
      .single();

    if (harmonyError || !harmony) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    // Get HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 });
    }

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

    // Start scan in background (don't await)
    performScan(job.id, {
      orgId: ctx.orgId,
      portalId: connection.portal_id,
      accessToken,
      objectType: harmony.object_type === 'company' ? 'companies' : 'contacts',
      fieldName: harmony.field,
    }).catch((err) => {
      console.error('[Scan Job] Background scan failed:', err);
      captureWithOrgContext(err, ctx.orgId, { jobId: job.id });
    });

    return NextResponse.json({ jobId: job.id, success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: `/api/harmonies/${harmonyId}/scan` });
    console.error('[Scan Job] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to start scan' }, { status: 500 });
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

    // Perform scan
    const distinctValues = await scanHubSpotField({
      ...options,
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
