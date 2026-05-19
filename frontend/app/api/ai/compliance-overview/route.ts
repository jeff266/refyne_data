import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { getScore, getPreviousScore, getBreakdownByHarmony } from '@/lib/compliance';
import { generateSummary } from '@/lib/ai/claude-client';
import { getCachedSummary, setCachedSummary } from '@/lib/ai/cache';
import {
  COMPLIANCE_OVERVIEW_SYSTEM,
  buildCompliancePrompt,
  type ComplianceInput,
  type ComplianceOutput,
} from '@/lib/ai/prompts/compliance-overview';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { createHash } from 'crypto';

/**
 * GET /api/ai/compliance-overview
 *
 * Generates AI-powered compliance overview with actionable recommendations.
 * Implements 3-tier caching: Upstash → ai_summaries → Claude API
 *
 * Auth: any role
 * Query: portalId? (optional, for portal-filtered view)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    if (!ctx.authorized) {
      return NextResponse.json({ error: ctx.error }, { status: 401 });
    }
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const portalId = searchParams.get('portalId') || 'all';
    const cacheKey = `ai:compliance:${ctx.orgId}:${portalId}`;

    // Step 1: Check Upstash cache
    const cached = await getCachedSummary<ComplianceOutput & { generatedAt: string }>(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Step 2: Build input data
    const inputData = await buildInputData(ctx.orgId, portalId);

    // Step 3: Check ai_summaries table for matching input_hash
    const inputHash = createHash('sha256').update(JSON.stringify(inputData)).digest('hex');

    if (supabase) {
      const { data: stored } = await supabase
        .from('ai_summaries')
        .select('output_data, created_at')
        .eq('org_id', ctx.orgId)
        .eq('surface', 'compliance_overview')
        .eq('input_hash', inputHash)
        .single();

      if (stored) {
        const output = {
          ...(stored.output_data as ComplianceOutput),
          generatedAt: stored.created_at,
          cached: true,
        };

        // Re-cache in Upstash
        await setCachedSummary(cacheKey, output, 3600);

        return NextResponse.json(output);
      }
    }

    // Step 4: Generate via Claude Haiku
    const userPrompt = buildCompliancePrompt(inputData);
    const output = await generateSummary<ComplianceOutput>(
      COMPLIANCE_OVERVIEW_SYSTEM,
      userPrompt,
      ctx.orgId,
      'compliance_overview',
      inputData
    );

    const response = {
      ...output,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    // Step 5: Cache in Upstash (TTL 1 hour)
    await setCachedSummary(cacheKey, response, 3600);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AI Compliance Overview] Error:', error);
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/ai/compliance-overview',
      severity: 'warning', // Don't alert on AI errors
    });

    // Return error but don't block page load
    return NextResponse.json(
      { error: 'Failed to generate overview' },
      { status: 500 }
    );
  }
}

/**
 * Build input data from compliance, dedup, and quarantine sources.
 */
async function buildInputData(orgId: string, portalId: string): Promise<ComplianceInput> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Fetch compliance score
  const currentScore = await getScore(orgId);
  const previousScore = await getPreviousScore(orgId);
  const scoreDelta = previousScore !== null
    ? Math.round((currentScore.score - previousScore) * 100) / 100
    : 0;

  // Fetch harmony breakdown
  const breakdown = await getBreakdownByHarmony(orgId);
  const harmonyBreakdown = breakdown.map((item) => ({
    name: item.harmonyId,
    score: Math.round((item.compliantCount / (item.totalCount || 1)) * 100),
    failingRecords: item.totalCount - item.compliantCount,
  }));

  // Fetch dedup pairs by grade
  const { data: dedupPairs } = await supabase
    .from('dedup_pairs')
    .select('grade')
    .eq('org_id', orgId)
    .eq('status', 'pending');

  const gradeA = dedupPairs?.filter((p) => p.grade === 'A').length || 0;
  const gradeB = dedupPairs?.filter((p) => p.grade === 'B').length || 0;

  // Fetch quarantine count
  const { count: quarantineCount } = await supabase
    .from('quarantine_records')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'pending');

  // Fetch last normalize run
  const { data: lastRun } = await supabase
    .from('normalize_runs')
    .select('created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch total records and gaps
  const { count: totalRecords } = await supabase
    .from('normalized_records')
    .select('record_id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const { count: recordsWithGaps } = await supabase
    .from('normalized_records')
    .select('record_id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'unprocessed');

  // Fetch weekly score trend
  const { data: scoreHistory } = await supabase
    .from('score_history')
    .select('score')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(4);

  const weeklyScores = scoreHistory?.map((s) => Math.round(s.score)) || [];

  // Get org name
  const { data: org } = await supabase
    .from('workspace_entitlements')
    .select('org_name')
    .eq('org_id', orgId)
    .single();

  return {
    orgName: org?.org_name || 'Your organization',
    currentScore: Math.round(currentScore.score),
    previousScore: previousScore !== null ? Math.round(previousScore) : Math.round(currentScore.score),
    scoreDelta,
    harmonyBreakdown,
    dedupPairs: { gradeA, gradeB },
    quarantineCount: quarantineCount || 0,
    lastNormalizeRun: lastRun?.created_at || null,
    totalRecords: totalRecords || 0,
    recordsWithGaps: recordsWithGaps || 0,
    weeklyScores,
  };
}
