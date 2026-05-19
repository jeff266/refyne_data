import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { transformKeys } from '@/lib/utils/transform';

/**
 * GET /api/arrangements/:id
 *
 * Returns a single arrangement by ID.
 * Auth: org:operator or above
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .single();

    if (error || !arrangement) {
      return NextResponse.json(
        { error: 'Arrangement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      arrangement: transformKeys(arrangement)
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/:id' });
    console.error('Failed to get arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to get arrangement' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/arrangements/:id
 *
 * Updates an arrangement.
 * Auth: org:operator or above
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.source_type !== undefined) updates.source_type = body.source_type;
    if (body.source_config !== undefined) updates.source_config = body.source_config;
    if (body.enrichment_steps !== undefined) updates.enrichment_steps = body.enrichment_steps;
    if (body.output_destination !== undefined) updates.output_destination = body.output_destination;
    if (body.output_config !== undefined) updates.output_config = body.output_config;

    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .update(updates)
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error || !arrangement) {
      return NextResponse.json(
        { error: 'Failed to update arrangement' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      arrangement: transformKeys(arrangement)
    });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/:id', action: 'update' });
    console.error('Failed to update arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to update arrangement' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/arrangements/:id
 *
 * Archives an arrangement (soft delete).
 * Auth: org:operator or above
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: arrangement, error } = await supabase
      .from('arrangements')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error || !arrangement) {
      return NextResponse.json(
        { error: 'Failed to archive arrangement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/:id', action: 'delete' });
    console.error('Failed to archive arrangement:', error);
    return NextResponse.json(
      { error: 'Failed to archive arrangement' },
      { status: 500 }
    );
  }
}
