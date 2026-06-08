import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/supabase';
import { currentUser } from '@clerk/nextjs/server';

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

  // Check if user is Refyne staff
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const isRefyneStaff = email?.endsWith('@refynedata.com') || email?.endsWith('@refyne.com');

  if (!isRefyneStaff) {
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
