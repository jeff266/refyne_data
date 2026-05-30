/**
 * GET /api/normalize/issue-counts
 *
 * Returns count of companies with non-canonical values per harmony field.
 * Results cached in Redis for 1 hour to avoid expensive recalculation.
 *
 * Response:
 * {
 *   "counts": {
 *     "company-industry": 1203,
 *     "phone-e164": 1156,
 *     "company-name": 847
 *   },
 *   "total_companies": 2798,
 *   "cached_at": "2026-05-30T12:34:56.789Z"
 * }
 */

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { countIssues } from '@/lib/normalize/issue-detector';
import type { Harmony } from '@/lib/harmonies/normalization-engine';
import { createRedisConnection, isRedisConfigured } from '@/lib/queue/redis';

const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function GET() {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
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

    // Get HubSpot connection
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json({
        counts: {},
        total_companies: 0,
        cached_at: new Date().toISOString(),
      });
    }

    // Check Redis cache first
    const cacheKey = `normalize:counts:${ctx.orgId}:${connection.portal_id}`;

    if (isRedisConfigured()) {
      try {
        const redis = createRedisConnection();
        const cached = await redis.get(cacheKey);

        if (cached) {
          console.log(`[Issue Counts] Cache hit for ${cacheKey}`);
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (err) {
        console.warn('[Issue Counts] Redis cache read failed:', err);
        // Continue without cache
      }
    }

    // Get access token
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      console.error('[Issue Counts] Failed to get HubSpot access token');
      return NextResponse.json({
        counts: {},
        total_companies: 0,
        cached_at: new Date().toISOString(),
      });
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch active harmonies
    const { data: harmoniesData, error: harmoniesError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

    if (harmoniesError) {
      captureWithOrgContext(harmoniesError, ctx.orgId, { route: '/api/normalize/issue-counts' });
      console.error('[Issue Counts] Failed to fetch harmonies:', harmoniesError);
      return NextResponse.json({ error: 'Failed to fetch harmonies' }, { status: 500 });
    }

    if (!harmoniesData || harmoniesData.length === 0) {
      return NextResponse.json({
        counts: {},
        total_companies: 0,
        cached_at: new Date().toISOString(),
      });
    }

    // Fetch org-specific settings for preset harmonies
    const presetHarmonyIds = harmoniesData.filter((h) => h.is_preset).map((h) => h.id);
    const { data: orgSettings } = presetHarmonyIds.length > 0
      ? await supabase
          .from('harmony_org_settings')
          .select('harmony_id, output_format')
          .eq('org_id', ctx.orgId)
          .in('harmony_id', presetHarmonyIds)
      : { data: [] };

    const orgSettingsMap = new Map(
      (orgSettings || []).map((s: any) => [s.harmony_id, s])
    );

    // Transform harmonies to engine format
    const harmonies: Harmony[] = harmoniesData.map((h) => {
      const orgSetting = orgSettingsMap.get(h.id);
      const effectiveOutputFormat = h.is_preset && orgSetting?.output_format
        ? orgSetting.output_format
        : h.output_format || 'default';

      return {
        id: h.id,
        name: h.name,
        field: h.field,
        objectType: h.object_type as 'company' | 'contact',
        transformType: h.transform_type || 'lookup',
        referenceTable: h.reference_table,
        fuzzyThreshold: h.fuzzy_threshold || 0.8,
        phoneticEnabled: h.phonetic_enabled || false,
        isActive: h.is_active,
        outputFormat: effectiveOutputFormat,
        outputFormatsAvailable: h.output_formats_available || [],
        isPreset: h.is_preset || false,
      };
    });

    console.log(`[Issue Counts] Calculating counts for ${harmonies.length} harmonies`);

    // Count issues for each harmony
    const counts: Record<string, number> = {};

    for (const harmony of harmonies) {
      try {
        const count = await countIssues(harmony, hubspot, ctx.orgId);
        counts[harmony.id] = count;
        console.log(`[Issue Counts] ${harmony.id}: ${count} issues`);
      } catch (err) {
        console.error(`[Issue Counts] Failed to count issues for ${harmony.id}:`, err);
        counts[harmony.id] = 0;
      }
    }

    // Get total companies (rough estimate from first search)
    let totalCompanies = 0;
    try {
      const allCompanies = await hubspot.searchCompanies(
        [],
        ['name'],
        100
      );
      totalCompanies = allCompanies.length;
    } catch (err) {
      console.warn('[Issue Counts] Failed to get total companies:', err);
    }

    const result = {
      counts,
      total_companies: totalCompanies,
      cached_at: new Date().toISOString(),
    };

    // Cache in Redis
    if (isRedisConfigured()) {
      try {
        const redis = createRedisConnection();
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
        console.log(`[Issue Counts] Cached result for ${cacheKey}`);
      } catch (err) {
        console.warn('[Issue Counts] Redis cache write failed:', err);
        // Continue without caching
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/issue-counts' });
    console.error('[Issue Counts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate issue counts' },
      { status: 500 }
    );
  }
}
