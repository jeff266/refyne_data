/**
 * Dedup Sample Pairs - Onboarding Calibration
 *
 * GET: Check if sample pairs exist, trigger scan if needed
 * POST: Force re-scan to generate new sample pairs
 *
 * Admin only. Samples stored as JSONB snapshots in onboarding_progress.
 * NEVER creates dedup_cluster or dedup_pair records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { HubSpotClient } from '@/lib/hubspot/client';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { evaluateCompanyPair } from '@/lib/dedup/company-signals';
import type { DedupSamplePair } from '@/lib/dedup/calibration-analyzer';
import { randomUUID } from 'crypto';

const MAX_SAMPLE_PAIRS = 10;
const MIN_CONFIDENCE = 0.85; // Grade B and above

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Check if samples already exist
    const { data: progress } = await supabaseAdmin
      .from('onboarding_progress')
      .select('dedup_sample_pairs')
      .eq('org_id', ctx.orgId)
      .single();

    const existingSamples = progress?.dedup_sample_pairs as DedupSamplePair[] | null;

    if (existingSamples && existingSamples.length > 0) {
      return NextResponse.json({
        status: 'ready',
        pairs: existingSamples,
      });
    }

    // No samples yet - trigger scan
    const samples = await generateSamplePairs(ctx.orgId);

    if (samples.length === 0) {
      return NextResponse.json({
        status: 'none',
        pairs: [],
      });
    }

    return NextResponse.json({
      status: 'ready',
      pairs: samples,
    });
  } catch (error) {
    console.error('[Dedup Sample] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate sample pairs', status: 'error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Force re-scan
    const samples = await generateSamplePairs(ctx.orgId);

    return NextResponse.json({
      status: samples.length > 0 ? 'ready' : 'none',
      pairs: samples,
    });
  } catch (error) {
    console.error('[Dedup Sample] Re-scan error:', error);
    return NextResponse.json(
      { error: 'Failed to re-scan for duplicates' },
      { status: 500 }
    );
  }
}

/**
 * Generate sample duplicate pairs for calibration
 * CRITICAL: Does NOT create dedup_cluster or dedup_pair records
 */
async function generateSamplePairs(orgId: string): Promise<DedupSamplePair[]> {
  console.log(`[Dedup Sample] Generating samples for org ${orgId}`);

  // Get HubSpot connection
  const { data: connection } = await supabaseAdmin
    .from('hubspot_connections')
    .select('portal_id, access_token')
    .eq('org_id', orgId)
    .eq('connection_status', 'connected')
    .single();

  if (!connection) {
    throw new Error('No HubSpot connection found');
  }

  // Get access token
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error('Failed to get access token');
  }

  const client = new HubSpotClient(accessToken, connection.portal_id);

  // Fetch recent companies (last 90 days, limit 50)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const properties = [
    'name', 'domain', 'industry', 'city', 'state',
    'numberofemployees', 'linkedin_company_page',
    'phone', 'createdate', 'hs_object_id', 'hubspot_owner_id'
  ];

  const companies = await client.searchCompanies(
    [{
      filters: [{
        propertyName: 'createdate',
        operator: 'GTE',
        value: ninetyDaysAgo.getTime().toString(),
      }]
    }],
    properties as readonly string[],
    50
  );

  const companiesFormatted = companies.map(c => ({
    id: c.id,
    name: c.properties.name || null,
    domain: c.properties.domain || null,
    industry: c.properties.industry || null,
    city: c.properties.city || null,
    state: c.properties.state || null,
    employee_count: c.properties.numberofemployees || null,
    owner_id: c.properties.hubspot_owner_id || null,
    linkedin_company_page: c.properties.linkedin_company_page || null,
    phone: c.properties.phone || null,
    createdate: c.properties.createdate || null,
  }));

  if (companiesFormatted.length < 2) {
    console.log('[Dedup Sample] Insufficient companies for comparison');
    await storeSamples(orgId, []);
    return [];
  }

  // Compare all pairs to find potential duplicates
  const samplePairs: DedupSamplePair[] = [];

  for (let i = 0; i < companiesFormatted.length && samplePairs.length < MAX_SAMPLE_PAIRS; i++) {
    for (let j = i + 1; j < companiesFormatted.length && samplePairs.length < MAX_SAMPLE_PAIRS; j++) {
      const companyA = companiesFormatted[i];
      const companyB = companiesFormatted[j];

      // Evaluate pair using existing signals logic
      const result = await evaluateCompanyPair(
        companyA as any,
        companyB as any
      );

      if (result.confidence >= MIN_CONFIDENCE && result.grade && ['A', 'B'].includes(result.grade)) {
        samplePairs.push({
          pair_id: randomUUID(),
          confidence: result.confidence,
          grade: result.grade as 'A' | 'B',
          signals_fired: result.signalsFired.map(s => s.type),
          company_a: {
            id: companyA.id,
            name: companyA.name,
            domain: companyA.domain,
            industry: companyA.industry,
            city: companyA.city,
            state: companyA.state,
            employee_count: companyA.employee_count,
            owner_name: null, // TODO: resolve from owners cache
            createdate: companyA.createdate,
          },
          company_b: {
            id: companyB.id,
            name: companyB.name,
            domain: companyB.domain,
            industry: companyB.industry,
            city: companyB.city,
            state: companyB.state,
            employee_count: companyB.employee_count,
            owner_name: null,
            createdate: companyB.createdate,
          },
        });
      }
    }
  }

  console.log(`[Dedup Sample] Found ${samplePairs.length} sample pairs`);

  // Store samples in onboarding_progress
  await storeSamples(orgId, samplePairs);

  return samplePairs;
}

async function storeSamples(orgId: string, samples: DedupSamplePair[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from('onboarding_progress')
    .update({
      dedup_sample_pairs: samples,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) {
    console.error('[Dedup Sample] Failed to store samples:', error);
    throw error;
  }
}
