import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/limits
 *
 * Returns all prospecting limits for the organization.
 */
export async function GET() {
  let ctx;
  try {
    ctx = getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: limits, error } = await supabase
      .from('prospecting_limits')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('applies_to', { ascending: true });

    if (error) {
      console.error('Failed to fetch limits:', error);
      return NextResponse.json({ error: 'Failed to fetch limits' }, { status: 500 });
    }

    return NextResponse.json({ limits });
  } catch (error) {
    console.error('Failed to get limits:', error);
    return NextResponse.json({ error: 'Failed to get limits' }, { status: 500 });
  }
}

/**
 * POST /api/limits
 *
 * Creates or updates a prospecting limit (admin only).
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { applies_to, credits_per_period, period } = body;

    if (!applies_to || !credits_per_period || !period) {
      return NextResponse.json(
        { error: 'applies_to, credits_per_period, and period are required' },
        { status: 400 }
      );
    }

    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: 'period must be day, week, or month' },
        { status: 400 }
      );
    }

    if (credits_per_period <= 0) {
      return NextResponse.json(
        { error: 'credits_per_period must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate applies_to format
    if (!applies_to.startsWith('user:') && !applies_to.startsWith('role:')) {
      return NextResponse.json(
        { error: 'applies_to must start with user: or role:' },
        { status: 400 }
      );
    }

    // Upsert limit
    const { data: limit, error } = await supabase
      .from('prospecting_limits')
      .upsert(
        {
          org_id: ctx.orgId,
          applies_to,
          credits_per_period,
          period,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,applies_to' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to create/update limit:', error);
      return NextResponse.json({ error: 'Failed to create/update limit' }, { status: 500 });
    }

    return NextResponse.json({ limit }, { status: 201 });
  } catch (error) {
    console.error('Failed to create limit:', error);
    return NextResponse.json({ error: 'Failed to create limit' }, { status: 500 });
  }
}
