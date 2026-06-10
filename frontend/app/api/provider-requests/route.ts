import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { checkRateLimit, rateLimiters } from '@/lib/api/rate-limit';
import { z } from 'zod';

const providerRequestSchema = z.object({
  provider_name: z.string().trim().min(1, 'Provider name is required').max(100),
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/provider-requests
 *
 * Creates a provider request from a user
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Rate limiting: prevent provider request spam
  const rateLimitResult = await checkRateLimit(rateLimiters.requests, ctx.orgId);
  if (rateLimitResult) return rateLimitResult;

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Validate request body
    const rawBody = await request.json();
    const validation = providerRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    const { data, error } = await supabase
      .from('provider_requests')
      .insert({
        org_id: ctx.orgId,
        requested_by: ctx.userId,
        provider_name: body.provider_name.trim(),
        reason: body.reason?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/provider-requests' });
      console.error('[Provider Requests] Insert failed:', error);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    return NextResponse.json({ request: data }, { status: 201 });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/provider-requests' });
    console.error('[Provider Requests] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
