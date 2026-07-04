import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Company count from company_dedup_index
    const { count: companyCount } = await supabaseAdmin
      .from('company_dedup_index')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Contact count from dedup_clusters (proxy)
    const { count: contactCount } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('object_type', 'contact');

    // Open dedup clusters (companies only)
    const { count: openClusters } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .eq('object_type', 'company');

    // Grade A clusters
    const { count: gradeA } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .eq('grade', 'A');

    // Grade B = open clusters - grade A
    const gradeB = (openClusters || 0) - (gradeA || 0);

    // Last dedup scan
    const { data: lastScan } = await supabaseAdmin
      .from('dedup_scan_runs')
      .select('started_at')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Last normalize run
    const { data: lastNormalize } = await supabaseAdmin
      .from('normalization_runs')
      .select('started_at, id')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Normalize issue counts (call internal API)
    let normalizeData = {
      issueCount: 0,
      lastRunAt: lastNormalize?.started_at || null,
      topIssues: [] as Array<{ field: string; label: string; count: number }>
    };

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const issueCountsRes = await fetch(`${baseUrl}/api/normalize/issue-counts`, {
        headers: {
          'Cookie': `__session=${(await auth()).sessionId}`
        }
      });

      if (issueCountsRes.ok) {
        const issueCountsData = await issueCountsRes.json();
        normalizeData.issueCount = issueCountsData.total || 0;
        normalizeData.topIssues = (issueCountsData.fields || [])
          .slice(0, 5)
          .map((f: any) => ({
            field: f.field_name,
            label: f.label || f.field_name,
            count: f.issue_count
          }));
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch normalize issue counts:', err);
    }

    // Recent activity from audit_log
    const { data: recentActivity } = await supabaseAdmin
      .from('audit_log')
      .select('action, object_label, metadata, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Billing from org_billing
    let { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('plan_type, trial_ends_at, trial_merges_used, trial_normalize_writes_used, trial_enrich_credits_used, trial_override_unlimited, current_period_start')
      .eq('org_id', orgId)
      .single();

    // If no billing record, return trial defaults
    if (!billing) {
      const fourteenDaysFromNow = new Date();
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

      billing = {
        plan_type: 'trial',
        trial_ends_at: fourteenDaysFromNow.toISOString(),
        trial_merges_used: 0,
        trial_normalize_writes_used: 0,
        trial_enrich_credits_used: 0,
        trial_override_unlimited: false,
        current_period_start: new Date().toISOString()
      };
    }

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (billing.plan_type === 'trial' && billing.trial_ends_at) {
      const now = new Date();
      const trialEnd = new Date(billing.trial_ends_at);
      const diffTime = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Credits used this period from org_usage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usageData } = await supabaseAdmin
      .from('org_usage')
      .select('credits_used')
      .eq('org_id', orgId)
      .in('provider', ['refyne_search', 'graphiq_managed'])
      .gte('created_at', billing?.current_period_start ?? thirtyDaysAgo.toISOString());

    const creditsUsed = usageData?.reduce((sum, row) => sum + (row.credits_used || 0), 0) || 0;

    // Enrich gaps (call internal API)
    let enrichData = {
      creditsUsed,
      creditsIncluded: 500,
      topGaps: [] as Array<{ field: string; missing: number; coverage: number }>
    };

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const enrichGapsRes = await fetch(`${baseUrl}/api/enrich/gaps`, {
        headers: {
          'Cookie': `__session=${(await auth()).sessionId}`
        }
      });

      if (enrichGapsRes.ok) {
        const enrichGapsData = await enrichGapsRes.json();
        enrichData.topGaps = (enrichGapsData.gaps || [])
          .slice(0, 3)
          .map((g: any) => ({
            field: g.field_name,
            missing: g.missing_count,
            coverage: g.coverage_percent
          }));
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch enrich gaps:', err);
    }

    // Trial limits
    const trialLimits = billing.plan_type === 'trial' ? {
      mergesUsed: billing.trial_merges_used || 0,
      mergesLimit: 10,
      writesUsed: billing.trial_normalize_writes_used || 0,
      writesLimit: 500,
      creditsUsed: billing.trial_enrich_credits_used || 0,
      creditsLimit: 500
    } : null;

    return NextResponse.json({
      portal: {
        companyCount: companyCount === 0 ? null : companyCount,
        contactCount: contactCount === 0 ? null : contactCount
      },
      normalize: normalizeData,
      dedup: {
        openClusters: openClusters || 0,
        gradeA: gradeA || 0,
        gradeB: gradeB || 0,
        lastScanAt: lastScan?.started_at || null
      },
      enrich: enrichData,
      recentActivity: (recentActivity || []).map(a => ({
        action: a.action,
        objectLabel: a.object_label,
        metadata: a.metadata,
        createdAt: a.created_at
      })),
      billing: {
        planType: billing.plan_type || 'trial',
        daysRemaining,
        trialLimits
      }
    });

  } catch (error) {
    console.error('[Dashboard] Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
