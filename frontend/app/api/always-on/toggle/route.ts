import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { AlwaysOnToggleRequest, AlwaysOnToggleResponse } from '@/lib/always-on/types';

/**
 * POST /api/always-on/toggle
 *
 * Toggles Always On enabled state.
 * Auth: admin only (TODO: implement auth check)
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default';
    const body: AlwaysOnToggleRequest = await request.json();

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    // Upsert workspace entitlement
    const updates: any = {
      org_id: orgId,
      always_on_enabled: body.enabled,
    };

    // If enabling and not already enabled, set always_on_since
    if (body.enabled) {
      const { data: existing } = await supabase
        .from('workspace_entitlements')
        .select('always_on_enabled, always_on_since')
        .eq('org_id', orgId)
        .single();

      if (!existing?.always_on_enabled || !existing?.always_on_since) {
        updates.always_on_since = new Date().toISOString();
      }
    }

    const { data: entitlement, error } = await supabase
      .from('workspace_entitlements')
      .upsert(updates, {
        onConflict: 'org_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to toggle Always On:', error);
      return NextResponse.json(
        { error: 'Failed to toggle Always On' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enabled: entitlement.always_on_enabled,
      alwaysOnSince: entitlement.always_on_since,
    } as AlwaysOnToggleResponse);
  } catch (error) {
    console.error('Failed to toggle Always On:', error);
    return NextResponse.json(
      { error: 'Failed to toggle Always On' },
      { status: 500 }
    );
  }
}
