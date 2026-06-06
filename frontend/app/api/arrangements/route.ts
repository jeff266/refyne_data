import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformArray } from '@/lib/utils/transform';
import { track } from '@/lib/telemetry/track';

/**
 * GET /api/arrangements
 *
 * Returns list of arrangements for the org.
 * Auth: org:operator or above
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === 'true';

    let query = supabase
      .from('arrangements')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data: arrangements, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements' });
      console.error('Failed to get arrangements:', error);
      return NextResponse.json(
        { error: 'Failed to get arrangements' },
        { status: 500 }
      );
    }

    // Enrich arrangements with run statistics
    const enrichedArrangements = await Promise.all(
      (arrangements || []).map(async (arr) => {
        // Get run statistics
        if (!supabase) {
          return {
            ...arr,
            enrichment_steps: [],
            total_runs: 0,
            last_run_at: null,
            last_run_stats: null,
            total_processed_records: 0,
            total_credits_used: 0,
          };
        }

        const { data: runs } = await supabase
          .from('arrangement_runs')
          .select('id, status, processed_records, total_records, fields_filled, started_at, completed_at, duration')
          .eq('arrangement_id', arr.id)
          .order('started_at', { ascending: false });

        const totalRuns = runs?.length || 0;
        const lastRun = runs?.[0];
        const completedRuns = runs?.filter(r => r.status === 'completed') || [];

        // Calculate total records processed
        const totalRecordsProcessed = completedRuns.reduce((sum, r) => sum + (r.processed_records || 0), 0);

        // Extract enrichment steps from field_configs (v2) or use enrichment_steps (v1)
        let enrichmentSteps: any[] = [];
        if (arr.field_configs && Array.isArray(arr.field_configs)) {
          // V2: extract from field_configs
          const providers = new Set<string>();
          const fieldsByProvider = new Map<string, Set<string>>();

          arr.field_configs.forEach((fieldConfig: any) => {
            if (fieldConfig.steps) {
              fieldConfig.steps.forEach((step: any) => {
                providers.add(step.provider);
                if (!fieldsByProvider.has(step.provider)) {
                  fieldsByProvider.set(step.provider, new Set());
                }
                fieldsByProvider.get(step.provider)!.add(fieldConfig.field_key);
              });
            }
          });

          enrichmentSteps = Array.from(providers).map((provider, index) => ({
            provider,
            fields: Array.from(fieldsByProvider.get(provider) || []),
            order: index + 1,
          }));
        } else if (arr.enrichment_steps) {
          // V1: use enrichment_steps
          enrichmentSteps = arr.enrichment_steps;
        }

        // Calculate last run stats
        let lastRunStats = null;
        if (lastRun && lastRun.status === 'completed') {
          const fieldsFilled = lastRun.fields_filled || {};
          const totalFilled = Object.values(fieldsFilled).reduce((sum: number, count: any) => sum + (count || 0), 0);
          const fillRate = lastRun.total_records > 0 ? totalFilled / (lastRun.total_records * Object.keys(fieldsFilled).length) : 0;

          lastRunStats = {
            records_enriched: lastRun.processed_records || 0,
            fill_rate: fillRate,
            duration_seconds: lastRun.duration || 0,
          };
        }

        return {
          ...arr,
          enrichment_steps: enrichmentSteps,
          total_runs: totalRuns,
          last_run_at: lastRun?.started_at || null,
          last_run_stats: lastRunStats,
          total_processed_records: totalRecordsProcessed,
          total_credits_used: 0, // TODO: track credits
        };
      })
    );

    return NextResponse.json({
      arrangements: transformArray(enrichedArrangements)
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements' });
    console.error('Failed to get arrangements:', error);
    return NextResponse.json(
      { error: 'Failed to get arrangements' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arrangements
 *
 * Creates a new arrangement.
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
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.source_type || !body.source_config || !body.output_destination || !body.output_config) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Support both v1 (enrichment_steps) and v2 (field_configs)
    const enrichmentSteps = body.enrichment_steps || [];
    const fieldConfigs = body.field_configs || null;

    // Create arrangement
    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .insert({
        org_id: ctx.orgId,
        name: body.name,
        description: body.description || null,
        source_type: body.source_type,
        source_config: body.source_config,
        enrichment_steps: enrichmentSteps, // v1 (legacy)
        field_configs: fieldConfigs, // v2 (waterfall)
        output_destination: body.output_destination,
        output_config: body.output_config,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements', action: 'create' });
      console.error('Failed to create arrangement:', error);
      return NextResponse.json(
        { error: 'Failed to create arrangement' },
        { status: 500 }
      );
    }

    // Track arrangement_created event
    track({
      event: 'arrangement_created',
      orgId: ctx.orgId,
      userId: ctx.userId,
      metadata: {
        arrangement_id: arrangement.id,
        source_type: body.source_type,
        has_field_configs: !!fieldConfigs,
      },
    });

    return NextResponse.json({
      arrangement: transformArray([arrangement])[0]
    }, { status: 201 });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements', action: 'create' });
    console.error('Failed to create arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to create arrangement' },
      { status: 500 }
    );
  }
}
