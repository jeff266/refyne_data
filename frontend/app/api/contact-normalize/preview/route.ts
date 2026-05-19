import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { createHubSpotClient } from '@/lib/hubspot/client';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getHarmoniesByEntity, getHarmonyById } from '@/lib/harmonies/library';
import { Normalizer } from '@/lib/harmonies/pipeline/normalizer';
import type { RawCandidate } from '@/lib/harmonies/pipeline/types';

/**
 * POST /api/contact-normalize/preview
 *
 * Preview normalization changes without applying them.
 * Returns sample of contacts that would be affected.
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: normalize
  try {
    await requireFeature(ctx.orgId, 'normalize');
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
    const body = await request.json();
    const harmonyIds = body.harmonyIds as string[];
    const limit = Math.min(body.limit || 100, 1000);

    if (!harmonyIds || harmonyIds.length === 0) {
      return NextResponse.json(
        { error: 'harmonyIds array is required' },
        { status: 400 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(orgId);
    const clientResult = await createHubSpotClient(accessToken);
    if ('error' in clientResult) {
      return NextResponse.json(
        { error: `HubSpot client error: ${clientResult.error}` },
        { status: 500 }
      );
    }
    const { client } = clientResult;

    // Load harmonies
    const harmonies = harmonyIds.map((id) => getHarmonyById(id)).filter(Boolean);
    if (harmonies.length === 0) {
      return NextResponse.json(
        { error: 'No valid harmonies found' },
        { status: 400 }
      );
    }

    // Fetch sample of contacts
    const response = await client.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
      }>;
    }>(`/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,jobtitle,city,state,country`, {
      method: 'GET',
    });

    const normalizer = new Normalizer(harmonies);
    const previews: Array<{
      contactId: string;
      field: string;
      before: string | null;
      after: string | null;
      harmonyId: string;
    }> = [];

    // Process each contact
    for (const contact of response.results) {
      for (const harmony of harmonies) {
        // Determine which field this harmony applies to
        const fields = harmony.spec.applies_to.fields;
        for (const field of fields) {
          const fieldName = field.replace('contact.', '');
          const value = contact.properties[fieldName];

          if (value) {
            const candidate: RawCandidate = {
              value,
              source: 'hubspot',
              retrieved_at: new Date().toISOString(),
              record: contact.properties,
            };

            const result = await normalizer.normalize(candidate);

            if (result.success && result.candidate) {
              const normalized = String(result.candidate.value);
              if (normalized !== value) {
                previews.push({
                  contactId: contact.id,
                  field: fieldName,
                  before: value,
                  after: normalized,
                  harmonyId: harmony.spec.id,
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      previews: previews.slice(0, limit),
      total: previews.length,
      contactsScanned: response.results.length,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-normalize/preview' });
    console.error('Failed to preview contact normalization:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
