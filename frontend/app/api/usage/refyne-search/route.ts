import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/supabase';

// Pricing constants
const SERPER_COST_PER_CALL = 0.001; // $1 per 1000 calls
const JINA_COST_PER_FETCH = 0.00002; // $0.02 per 1000 fetches (free tier, but track for visibility)
const CREDIT_OVERAGE_COST = 0.012; // $0.012 per credit over limit

// Plan credit limits (hardcoded for now, will wire to Stripe later)
const PLAN_LIMITS: Record<string, number> = {
  starter: 10000,
  growth: 20000,
  scale: 35000,
  trial: 500, // default
};

/**
 * GET /api/usage/refyne-search
 *
 * Query params:
 *   period: current_month (default) | last_month | last_7_days
 *
 * Returns usage metrics, costs, and metering for Refyne Search enrichment.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'current_month';

    // Calculate date range
    const { start, end } = getDateRange(period);

    // Query usage data for this org and period
    const { data: usageRows, error: usageError } = await supabaseAdmin
      .from('refyne_search_usage')
      .select('*')
      .eq('org_id', ctx.orgId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (usageError) {
      console.error('[Usage API] Failed to query usage:', usageError);
      return NextResponse.json({ error: 'Failed to query usage data' }, { status: 500 });
    }

    // Get org plan (hardcoded for now)
    // TODO: Query org_enrichment_settings or Stripe subscription
    const planType = 'trial'; // Hardcoded - will wire to Stripe later
    const creditsIncluded = PLAN_LIMITS[planType] || PLAN_LIMITS.trial;

    // Aggregate metrics
    const summary = {
      total_companies: new Set(usageRows.map((r: any) => r.domain)).size,
      total_field_lookups: usageRows.length,
      cache_hits: usageRows.filter((r: any) => r.cache_hit).length,
      cache_hit_rate: usageRows.length > 0
        ? usageRows.filter((r: any) => r.cache_hit).length / usageRows.length
        : 0,
      serper_calls: usageRows.reduce((sum: number, r: any) => sum + (r.serper_calls || 0), 0),
      jina_fetches: usageRows.filter((r: any) => r.jina_fetched).length,
      deepseek_calls: usageRows.filter((r: any) => r.model_used === 'deepseek').length,
      haiku_calls: usageRows.filter((r: any) => r.model_used === 'haiku').length,
      total_cost_usd: usageRows.reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0),
      cost_breakdown: {
        serper_usd: usageRows.reduce((sum: number, r: any) =>
          sum + (r.serper_calls || 0) * SERPER_COST_PER_CALL, 0),
        jina_usd: usageRows.filter((r: any) => r.jina_fetched).length * JINA_COST_PER_FETCH,
        deepseek_usd: usageRows
          .filter((r: any) => r.model_used === 'deepseek')
          .reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0),
        haiku_usd: usageRows
          .filter((r: any) => r.model_used === 'haiku')
          .reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0),
      },
    };

    // Metering calculations (1 credit = 1 company enriched)
    const creditsUsed = summary.total_companies;
    const creditsRemaining = Math.max(0, creditsIncluded - creditsUsed);
    const overageCredits = Math.max(0, creditsUsed - creditsIncluded);
    const overageCostUsd = overageCredits * CREDIT_OVERAGE_COST;

    // Project to end of month
    const daysElapsed = Math.max(1, (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysInPeriod = period === 'current_month'
      ? new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
      : daysElapsed;
    const projectionMultiplier = period === 'current_month'
      ? daysInPeriod / daysElapsed
      : 1;

    const projectedMonthlyCost = summary.total_cost_usd * projectionMultiplier;
    const projectedMonthlyCredits = creditsUsed * projectionMultiplier;
    const projectedOverage = Math.max(0, projectedMonthlyCredits - creditsIncluded);
    const projectedBillUsd = projectedOverage * CREDIT_OVERAGE_COST;

    // By-model breakdown
    const byModel = {
      deepseek: {
        calls: summary.deepseek_calls,
        cost_usd: summary.cost_breakdown.deepseek_usd,
      },
      haiku: {
        calls: summary.haiku_calls,
        cost_usd: summary.cost_breakdown.haiku_usd,
      },
      cache: {
        hits: summary.cache_hits,
      },
    };

    // Recent enrichments (last 10 domains)
    const recentDomains = Array.from(new Set(usageRows.map((r: any) => r.domain)))
      .slice(-10)
      .reverse();

    const recent = recentDomains.map((domain) => {
      const domainRows = usageRows.filter((r: any) => r.domain === domain);
      const firstRow = domainRows[0];
      return {
        domain,
        fields_enriched: domainRows.length,
        cost_usd: domainRows.reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0),
        model_used: firstRow?.model_used || 'unknown',
        cache_hit: firstRow?.cache_hit || false,
        created_at: firstRow?.created_at || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary,
      metering: {
        credits_used: creditsUsed,
        credits_included: creditsIncluded,
        credits_remaining: creditsRemaining,
        overage_credits: overageCredits,
        overage_cost_usd: overageCostUsd,
        projected_monthly_cost: projectedMonthlyCost,
        projected_bill_usd: projectedBillUsd,
      },
      by_model: byModel,
      recent,
    });
  } catch (error) {
    console.error('[Usage API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(); // Current time

  switch (period) {
    case 'last_7_days':
      const start7 = new Date(now);
      start7.setDate(now.getDate() - 7);
      start7.setHours(0, 0, 0, 0);
      return { start: start7, end };

    case 'last_month':
      const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
      endLast.setHours(23, 59, 59, 999);
      return { start: startLast, end: endLast };

    case 'current_month':
    default:
      const startCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
      startCurrent.setHours(0, 0, 0, 0);
      return { start: startCurrent, end };
  }
}
