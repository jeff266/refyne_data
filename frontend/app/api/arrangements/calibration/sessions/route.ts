import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireAdmin } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/arrangements/calibration/sessions
 *
 * Returns calibration session history for the org
 * Auth: org:admin only
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
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
    const limit = parseInt(searchParams.get('limit') || '50');

    const { data: sessions, error } = await supabase
      .from('calibration_sessions')
      .select('id, field_key, field_type, providers, sample_size, credits_used, status, created_at, completed_at')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/calibration/sessions' });
      console.error('Failed to get calibration sessions:', error);
      return NextResponse.json(
        { error: 'Failed to get calibration sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions: sessions || [] });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/calibration/sessions' });
    console.error('Failed to get calibration sessions:', error);
    return NextResponse.json(
      { error: 'Failed to get calibration sessions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arrangements/calibration/sessions
 *
 * Creates a new calibration session (starts calibration for a field)
 * Auth: org:admin only
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
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
    if (!body.field_key || !body.field_type || !body.providers || !Array.isArray(body.providers)) {
      return NextResponse.json(
        { error: 'Missing required fields: field_key, field_type, providers' },
        { status: 400 }
      );
    }

    // Create session
    const { data: session, error } = await supabase
      .from('calibration_sessions')
      .insert({
        org_id: ctx.orgId,
        field_key: body.field_key,
        field_type: body.field_type,
        providers: body.providers,
        sample_size: body.sample_size || 10,
        status: 'pending',
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/calibration/sessions', action: 'create' });
      console.error('Failed to create calibration session:', error);
      return NextResponse.json(
        { error: 'Failed to create calibration session' },
        { status: 500 }
      );
    }

    // TODO: Enqueue calibration job to BullMQ
    // This will be implemented in a later phase

    return NextResponse.json({ session }, { status: 201 });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/arrangements/calibration/sessions', action: 'create' });
    console.error('Failed to create calibration session:', error);
    return NextResponse.json(
      { error: 'Failed to create calibration session' },
      { status: 500 }
    );
  }
}
