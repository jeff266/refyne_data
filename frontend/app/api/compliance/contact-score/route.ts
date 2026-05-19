import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * Contact compliance metric weights.
 * email (30), phone (15), name (10), title (10), company (15), no_dupes (20)
 */
const METRIC_WEIGHTS = {
  email: 30,
  phone: 15,
  name: 10,
  title: 10,
  company: 15,
  no_dupes: 20,
} as const;

/**
 * GET /api/compliance/contact-score
 *
 * Get contact compliance score for the organization.
 * Returns weighted score based on 6 metrics.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: compliance
  try {
    await requireFeature(ctx.orgId, 'compliance');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;

    // Get contact field compliance from normalized_records
    const { data: records, error: recordsError } = await supabase
      .from('normalized_records')
      .select('field, status')
      .eq('org_id', orgId)
      .eq('record_type', 'contact');

    if (recordsError) {
      captureWithOrgContext(recordsError, ctx.orgId, { route: '/api/compliance/contact-score' });
      return NextResponse.json(
        { error: 'Failed to fetch compliance data' },
        { status: 500 }
      );
    }

    // Get dedup score (% without duplicates)
    const { count: totalContactCount, error: totalError } = await supabase
      .from('normalized_records')
      .select('record_id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('record_type', 'contact');

    const { count: dupeCount, error: dupeError } = await supabase
      .from('contact_dedup_pairs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['pending', 'approved'])
      .in('grade', ['A', 'B']);

    if (totalError || dupeError) {
      // Non-fatal - use 100% if we can't get dedup data
      console.warn('Failed to get dedup data for contact score');
    }
    const noDupesRate = (totalContactCount ?? 0) > 0 ? (((totalContactCount ?? 0) - (dupeCount ?? 0)) / (totalContactCount ?? 0)) * 100 : 100;

    // Calculate field-level metrics
    const fieldMetrics: Record<string, { compliant: number; total: number; rate: number }> = {
      email: { compliant: 0, total: 0, rate: 0 },
      phone: { compliant: 0, total: 0, rate: 0 },
      name: { compliant: 0, total: 0, rate: 0 },
      title: { compliant: 0, total: 0, rate: 0 },
      company: { compliant: 0, total: 0, rate: 0 },
    };

    if (records) {
      for (const record of records) {
        const field = record.field;

        // Map field names to metrics
        let metricKey: keyof typeof fieldMetrics | null = null;
        if (field === 'email') metricKey = 'email';
        else if (field === 'phone' || field === 'mobilephone') metricKey = 'phone';
        else if (field === 'firstname' || field === 'lastname') metricKey = 'name';
        else if (field === 'jobtitle') metricKey = 'title';
        else if (field === 'company') metricKey = 'company';

        if (metricKey) {
          fieldMetrics[metricKey].total++;
          if (record.status === 'compliant') {
            fieldMetrics[metricKey].compliant++;
          }
        }
      }

      // Calculate rates
      for (const key of Object.keys(fieldMetrics) as Array<keyof typeof fieldMetrics>) {
        const metric = fieldMetrics[key];
        metric.rate = metric.total > 0 ? (metric.compliant / metric.total) * 100 : 0;
      }
    }

    // Calculate weighted score
    let weightedScore = 0;
    weightedScore += (fieldMetrics.email.rate / 100) * METRIC_WEIGHTS.email;
    weightedScore += (fieldMetrics.phone.rate / 100) * METRIC_WEIGHTS.phone;
    weightedScore += (fieldMetrics.name.rate / 100) * METRIC_WEIGHTS.name;
    weightedScore += (fieldMetrics.title.rate / 100) * METRIC_WEIGHTS.title;
    weightedScore += (fieldMetrics.company.rate / 100) * METRIC_WEIGHTS.company;
    weightedScore += (noDupesRate / 100) * METRIC_WEIGHTS.no_dupes;

    return NextResponse.json({
      score: Math.round(weightedScore),
      metrics: {
        email: {
          weight: METRIC_WEIGHTS.email,
          rate: Math.round(fieldMetrics.email.rate),
          compliant: fieldMetrics.email.compliant,
          total: fieldMetrics.email.total,
        },
        phone: {
          weight: METRIC_WEIGHTS.phone,
          rate: Math.round(fieldMetrics.phone.rate),
          compliant: fieldMetrics.phone.compliant,
          total: fieldMetrics.phone.total,
        },
        name: {
          weight: METRIC_WEIGHTS.name,
          rate: Math.round(fieldMetrics.name.rate),
          compliant: fieldMetrics.name.compliant,
          total: fieldMetrics.name.total,
        },
        title: {
          weight: METRIC_WEIGHTS.title,
          rate: Math.round(fieldMetrics.title.rate),
          compliant: fieldMetrics.title.compliant,
          total: fieldMetrics.title.total,
        },
        company: {
          weight: METRIC_WEIGHTS.company,
          rate: Math.round(fieldMetrics.company.rate),
          compliant: fieldMetrics.company.compliant,
          total: fieldMetrics.company.total,
        },
        no_dupes: {
          weight: METRIC_WEIGHTS.no_dupes,
          rate: Math.round(noDupesRate),
          duplicatesFound: dupeCount ?? 0,
          totalContacts: totalContactCount ?? 0,
        },
      },
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/compliance/contact-score' });
    console.error('Failed to calculate contact compliance score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate score' },
      { status: 500 }
    );
  }
}
