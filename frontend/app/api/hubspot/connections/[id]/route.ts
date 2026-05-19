import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * PUT /api/hubspot/connections/:id
 *
 * Update connection settings (e.g., friendly name)
 * Auth: org:admin or org:operator
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
    if (ctx.orgRole === 'org:viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
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

    const { id } = params;
    const body = await request.json();
    const { friendlyName } = body;

    // Validate input
    if (typeof friendlyName !== 'string') {
      return NextResponse.json(
        { error: 'friendlyName must be a string' },
        { status: 400 }
      );
    }

    // Update connection
    const { data, error } = await supabase
      .from('hubspot_connections')
      .update({ friendly_name: friendlyName || null })
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections/:id' });
      console.error('Failed to update connection:', error);
      return NextResponse.json(
        { error: 'Failed to update connection' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/hubspot/connections/:id' });
    console.error('Failed to update connection:', error);
    return NextResponse.json(
      { error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}
