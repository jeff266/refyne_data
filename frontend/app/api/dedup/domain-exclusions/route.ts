import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DomainExclusionRow {
  id: string;
  org_id: string;
  domain: string;
  is_preset: boolean;
  created_at: string;
}

export interface DomainExclusion {
  id: string;
  domain: string;
  isPreset: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function rowToExclusion(row: DomainExclusionRow): DomainExclusion {
  return {
    id: row.id,
    domain: row.domain,
    isPreset: row.is_preset,
    createdAt: row.created_at,
  };
}

/**
 * Normalize domain for storage (lowercase, no www prefix, no protocol).
 */
function normalizeDomain(domain: string): string {
  let cleaned = domain.trim().toLowerCase();

  // Remove protocol if present
  cleaned = cleaned.replace(/^https?:\/\//, '');

  // Remove www prefix
  cleaned = cleaned.replace(/^www\./, '');

  // Remove trailing slash
  cleaned = cleaned.replace(/\/$/, '');

  // Remove path
  cleaned = cleaned.split('/')[0];

  return cleaned;
}

/**
 * Validate domain format.
 */
function isValidDomain(domain: string): boolean {
  // Must contain at least one dot and valid characters
  const domainPattern = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/;
  return domainPattern.test(domain);
}

// ─────────────────────────────────────────────────────────────
// GET /api/dedup/domain-exclusions
// ─────────────────────────────────────────────────────────────

/**
 * List all domain exclusions for the org.
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
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

    const { data: exclusions, error } = await supabase
      .from('dedup_domain_exclusions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('domain', { ascending: true });

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/domain-exclusions' });
      console.error('Failed to get domain exclusions:', error);
      return NextResponse.json(
        { error: 'Failed to get exclusions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exclusions: (exclusions as DomainExclusionRow[]).map(rowToExclusion),
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/domain-exclusions' });
    console.error('Failed to get domain exclusions:', error);
    return NextResponse.json(
      { error: 'Failed to get exclusions' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/dedup/domain-exclusions
// ─────────────────────────────────────────────────────────────

/**
 * Add a new domain exclusion (custom, non-preset).
 */
export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
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

    const body = await request.json();
    const { domain } = body;

    // Validate domain
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'domain is required', field: 'domain' },
        { status: 400 }
      );
    }

    const normalized = normalizeDomain(domain);

    if (!isValidDomain(normalized)) {
      return NextResponse.json(
        { error: 'Invalid domain format', field: 'domain' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('dedup_domain_exclusions')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('domain', normalized)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Domain already excluded', field: 'domain' },
        { status: 409 }
      );
    }

    // Insert the exclusion
    const { data: created, error: insertError } = await supabase
      .from('dedup_domain_exclusions')
      .insert({
        org_id: ctx.orgId,
        domain: normalized,
        is_preset: false,
      })
      .select()
      .single();

    if (insertError) {
      captureWithOrgContext(insertError, ctx.orgId, { route: '/api/dedup/domain-exclusions' });
      console.error('Failed to create domain exclusion:', insertError);
      return NextResponse.json(
        { error: 'Failed to create exclusion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ exclusion: rowToExclusion(created as DomainExclusionRow) });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/domain-exclusions' });
    console.error('Failed to create domain exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to create exclusion' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/dedup/domain-exclusions?id=<uuid>
// ─────────────────────────────────────────────────────────────

/**
 * Remove a domain exclusion.
 * Only allows removal of non-preset domains (user-added custom exclusions).
 */
export async function DELETE(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter required' },
        { status: 400 }
      );
    }

    // Check if the exclusion exists and is not a preset
    const { data: exclusion, error: fetchError } = await supabase
      .from('dedup_domain_exclusions')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !exclusion) {
      return NextResponse.json(
        { error: 'Exclusion not found' },
        { status: 404 }
      );
    }

    if (exclusion.is_preset) {
      return NextResponse.json(
        { error: 'Cannot remove preset domain exclusions' },
        { status: 403 }
      );
    }

    // Delete the exclusion
    const { error: deleteError } = await supabase
      .from('dedup_domain_exclusions')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId);

    if (deleteError) {
      captureWithOrgContext(deleteError, ctx.orgId, { route: '/api/dedup/domain-exclusions' });
      console.error('Failed to delete domain exclusion:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete exclusion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/domain-exclusions' });
    console.error('Failed to delete domain exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to delete exclusion' },
      { status: 500 }
    );
  }
}
