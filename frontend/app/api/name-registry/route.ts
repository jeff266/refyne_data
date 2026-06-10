/**
 * Name Registry CRUD API
 *
 * GET  /api/name-registry - List registry entries (with search and pagination)
 * POST /api/name-registry - Create new org-scoped registry entry (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { z } from 'zod';

type RegistryType = 'company' | 'contact_first' | 'contact_last' | 'contact_token';
type Scope = 'org' | 'global';

const VALID_REGISTRY_TYPES: RegistryType[] = ['company', 'contact_first', 'contact_last', 'contact_token'];

interface RegistryEntry {
  id: string;
  org_id: string | null;
  registry_type: RegistryType;
  input_token: string;
  canonical_form: string;
  source: string;
  confidence: number;
  status: string;
  occurrence_count?: number;
  last_seen_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/name-registry
 *
 * Returns paginated list of registry entries.
 * All authenticated users can read (getOrgContext).
 *
 * Query params:
 *  - type: 'company' | 'contact_first' | 'contact_last' | 'contact_token' (required)
 *  - scope: 'org' | 'global' (required)
 *  - q: search term (optional, searches input_token and canonical_form)
 *  - page: page number (default 1)
 *  - per_page: items per page (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as RegistryType | null;
    const scope = searchParams.get('scope') as Scope | null;
    const q = searchParams.get('q');
    const pageParam = searchParams.get('page');
    const perPageParam = searchParams.get('per_page');

    // Validate required params
    if (!type || !VALID_REGISTRY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid or missing type. Must be one of: ${VALID_REGISTRY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!scope || !['org', 'global'].includes(scope)) {
      return NextResponse.json(
        { error: "Invalid or missing scope. Must be 'org' or 'global'" },
        { status: 400 }
      );
    }

    // Parse pagination params
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    let perPage = perPageParam ? parseInt(perPageParam, 10) : 50;

    // Validate per_page range
    if (isNaN(perPage) || perPage < 1) {
      perPage = 50;
    }
    if (perPage > 200) {
      perPage = 200;
    }

    const offset = (page - 1) * perPage;

    // Build query based on scope
    let query = supabaseAdmin
      .from('name_registry')
      .select('*', { count: 'exact' })
      .eq('registry_type', type);

    if (scope === 'org') {
      query = query.eq('org_id', ctx.orgId);
    } else {
      // scope === 'global'
      query = query.is('org_id', null);
    }

    // Add search filter if provided
    if (q && q.trim().length > 0) {
      const searchTerm = `%${q.trim()}%`;
      query = query.or(`input_token.ilike.${searchTerm},canonical_form.ilike.${searchTerm}`);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    const { data: items, error, count } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry' });
      console.error('Failed to fetch registry entries:', error);
      return NextResponse.json({ error: 'Failed to fetch registry entries' }, { status: 500 });
    }

    return NextResponse.json({
      items: items || [],
      total: count || 0,
      page,
      per_page: perPage,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry' });
    console.error('Failed to get registry entries:', error);
    return NextResponse.json({ error: 'Failed to get registry entries' }, { status: 500 });
  }
}

/**
 * POST /api/name-registry
 *
 * Creates a new org-scoped registry entry.
 * Admin only (requireAdmin).
 *
 * Body:
 *  - registry_type: 'company' | 'contact_first' | 'contact_last' | 'contact_token'
 *  - input_token: string (the input variant)
 *  - canonical_form: string (the canonical output)
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Validate request body
    const createRegistryEntrySchema = z.object({
      registry_type: z.enum(['company', 'contact_first', 'contact_last', 'contact_token']),
      input_token: z.string().trim().min(1, 'input_token is required'),
      canonical_form: z.string().trim().min(1, 'canonical_form is required'),
    });

    const rawBody = await request.json();
    const validation = createRegistryEntrySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    const { registry_type, input_token, canonical_form } = body;

    // Normalize input_token (lowercase, trimmed)
    const normalizedInputToken = input_token.toLowerCase().trim();

    // Insert into name_registry table
    const { data, error } = await supabaseAdmin
      .from('name_registry')
      .insert({
        org_id: ctx.orgId,
        registry_type,
        input_token: normalizedInputToken,
        canonical_form: canonical_form.trim(),
        source: 'manual',
        confidence: 1.0,
        status: 'active',
        occurrence_count: 1,
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A registry entry with this input_token already exists for this organization.' },
          { status: 409 }
        );
      }

      captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry' });
      console.error('Failed to create registry entry:', error);
      return NextResponse.json({ error: 'Failed to create registry entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry' });
    console.error('Failed to create registry entry:', error);
    return NextResponse.json({ error: 'Failed to create registry entry' }, { status: 500 });
  }
}
