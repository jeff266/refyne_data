import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/supabase';
import { clerkClient } from '@clerk/nextjs/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Staff check
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ctx.userId);
    const isStaff = user.publicMetadata?.isRefyneStaff === true;

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    console.error('[Assistant Patterns] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { is_suggested, suggested_prompt_text, suggested_prompt_icon } = body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (typeof is_suggested === 'boolean') updates.is_suggested = is_suggested;
    if (suggested_prompt_text !== undefined) updates.suggested_prompt_text = suggested_prompt_text;
    if (suggested_prompt_icon !== undefined) updates.suggested_prompt_icon = suggested_prompt_icon;

    const { data, error } = await supabaseAdmin
      .from('assistant_question_patterns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ pattern: data });
  } catch (error) {
    console.error('[Assistant Patterns] Update error:', error);
    return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 });
  }
}
