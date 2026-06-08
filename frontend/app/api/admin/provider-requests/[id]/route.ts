import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/supabase';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * PATCH /api/admin/provider-requests/[id]
 *
 * Updates a provider request (Refyne staff only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check if user is Refyne staff via Clerk metadata
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ctx.userId);
    const isStaff = user.publicMetadata?.isRefyneStaff === true;

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    console.error('[Admin Provider Requests] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) {
      if (!['pending', 'reviewing', 'shipped', 'declined'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.admin_notes !== undefined) {
      updates.admin_notes = body.admin_notes;
    }

    const { data, error } = await supabaseAdmin
      .from('provider_requests')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[Admin Provider Requests] Update failed:', error);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    return NextResponse.json({ request: data });

  } catch (error) {
    console.error('[Admin Provider Requests] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}
