import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { CONTEXT_MODEL } from '@/lib/assistant/context-builder';

/**
 * Debug endpoint to check assistant configuration
 * GET /api/assistant/debug
 */
export async function GET(req: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check workspace context
  const { data: wsContext, error: wsError } = await supabaseAdmin
    .from('workspace_context')
    .select('*')
    .eq('org_id', ctx.orgId)
    .single();

  // Check environment
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    context_model: CONTEXT_MODEL,
    has_anthropic_key: hasAnthropicKey,
    workspace_context: {
      exists: !!wsContext,
      version: wsContext?.version,
      built_at: wsContext?.built_at,
      built_by: wsContext?.built_by,
      context_hash: wsContext?.context_hash,
      has_interpreted_context: !!wsContext?.interpreted_context,
      interpreted_context_length: wsContext?.interpreted_context?.length || 0,
      error: wsError?.message,
    },
  });
}
