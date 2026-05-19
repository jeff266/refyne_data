import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { generateSummary } from '@/lib/ai/claude-client';
import { getCachedSummary, setCachedSummary } from '@/lib/ai/cache';
import {
  REHEARSAL_SUMMARY_SYSTEM,
  buildRehearsalPrompt,
  type RehearsalInput,
  type RehearsalOutput,
} from '@/lib/ai/prompts/rehearsal-summary';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/ai/rehearsal-summary
 *
 * Generates AI summary of arrangement rehearsal results.
 * Provides recommendations for optimizing before full run.
 *
 * Auth: org:admin or org:operator
 * Body: { runId: string }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check role (admin or operator)
  if (ctx.orgRole !== 'org:admin' && ctx.orgRole !== 'org:operator') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  try {
    const { runId } = await request.json();

    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      );
    }

    const cacheKey = `ai:rehearsal:${runId}`;

    // Step 1: Check Upstash cache (TTL 1 hour)
    const cached = await getCachedSummary<RehearsalOutput>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Step 2: Fetch arrangement run results
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Arrangement run not found' },
        { status: 404 }
      );
    }

    // Verify org ownership
    if (run.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Step 3: Build input data from run results
    const results = run.results as Record<string, unknown>;
    const inputData: RehearsalInput = {
      recordCount: (run.records_tested as number) || 0,
      overallFillRate: calculateOverallFillRate(results),
      providerResults: extractProviderResults(results),
      fieldResults: extractFieldResults(results),
      totalConflicts: (results.conflicts as number) || 0,
      conflictPolicy: run.conflict_policy || 'first_wins',
      estimatedManagedCredits: (run.estimated_credits as number) || 0,
      creditBalance: await getCreditBalance(ctx.orgId),
    };

    // Step 4: Generate via Claude
    const userPrompt = buildRehearsalPrompt(inputData);
    const output = await generateSummary<RehearsalOutput>(
      REHEARSAL_SUMMARY_SYSTEM,
      userPrompt,
      ctx.orgId,
      'rehearsal_summary',
      inputData
    );

    // Step 5: Cache in Upstash (TTL 1 hour)
    await setCachedSummary(cacheKey, output, 3600);

    return NextResponse.json(output);
  } catch (error) {
    console.error('[AI Rehearsal Summary] Error:', error);
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/ai/rehearsal-summary',
      severity: 'warning',
    });

    return NextResponse.json(
      { error: 'Failed to generate rehearsal summary' },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall fill rate from results.
 */
function calculateOverallFillRate(results: Record<string, unknown>): number {
  const fieldResults = results.fieldResults as Array<{ filled: number; total: number }> | undefined;
  if (!fieldResults || fieldResults.length === 0) return 0;

  const totalFilled = fieldResults.reduce((sum, f) => sum + f.filled, 0);
  const totalAttempted = fieldResults.reduce((sum, f) => sum + f.total, 0);

  return totalAttempted > 0 ? Math.round((totalFilled / totalAttempted) * 100) : 0;
}

/**
 * Extract provider-level results.
 */
function extractProviderResults(
  results: Record<string, unknown>
): Array<{ provider: string; fillRate: number }> {
  const providerResults = results.providerResults as Array<{
    provider: string;
    filled: number;
    total: number;
  }> | undefined;

  if (!providerResults) return [];

  return providerResults.map((p) => ({
    provider: p.provider,
    fillRate: p.total > 0 ? Math.round((p.filled / p.total) * 100) : 0,
  }));
}

/**
 * Extract field-level results.
 */
function extractFieldResults(
  results: Record<string, unknown>
): Array<{ fieldName: string; filled: number; conflicts: number }> {
  const fieldResults = results.fieldResults as Array<{
    field: string;
    filled: number;
    conflicts: number;
  }> | undefined;

  if (!fieldResults) return [];

  return fieldResults.map((f) => ({
    fieldName: f.field,
    filled: f.filled,
    conflicts: f.conflicts || 0,
  }));
}

/**
 * Get current credit balance for org.
 */
async function getCreditBalance(orgId: string): Promise<number> {
  if (!supabase) return 0;

  const { data } = await supabase
    .from('workspace_entitlements')
    .select('enrich_credits_limit, enrich_credits_used')
    .eq('org_id', orgId)
    .single();

  if (!data) return 0;

  return (data.enrich_credits_limit || 0) - (data.enrich_credits_used || 0);
}
