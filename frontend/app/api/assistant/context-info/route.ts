/**
 * Assistant Context - Metadata
 *
 * GET: Get context metadata for UI display
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { data } = await supabaseAdmin
    .from('workspace_context')
    .select('built_at, version, built_by')
    .eq('org_id', ctx.orgId)
    .single();

  return NextResponse.json({
    context: data || null,
  });
}
