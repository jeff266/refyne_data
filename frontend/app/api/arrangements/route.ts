import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements
 *
 * Returns list of arrangements for the org.
 * Auth: org:operator or above
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === 'true';

    let query = supabase
      .from('arrangements')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data: arrangements, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements' });
      console.error('Failed to get arrangements:', error);
      return NextResponse.json(
        { error: 'Failed to get arrangements' },
        { status: 500 }
      );
    }

    return NextResponse.json({ arrangements });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements' });
    console.error('Failed to get arrangements:', error);
    return NextResponse.json(
      { error: 'Failed to get arrangements' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arrangements
 *
 * Creates a new arrangement.
 * Auth: org:operator or above
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.source_type || !body.source_config || !body.enrichment_steps || !body.output_destination || !body.output_config) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create arrangement
    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .insert({
        org_id: ctx.orgId,
        name: body.name,
        description: body.description || null,
        source_type: body.source_type,
        source_config: body.source_config,
        enrichment_steps: body.enrichment_steps,
        output_destination: body.output_destination,
        output_config: body.output_config,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements', action: 'create' });
      console.error('Failed to create arrangement:', error);
      return NextResponse.json(
        { error: 'Failed to create arrangement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ arrangement }, { status: 201 });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements', action: 'create' });
    console.error('Failed to create arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to create arrangement' },
      { status: 500 }
    );
  }
}
