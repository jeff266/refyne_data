import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { logAuditEvent } from '@/lib/auth/audit-logger';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { transformKeys } from '@/lib/utils/transform';

/**
 * GET /api/org/settings
 *
 * Returns organization settings including push policy and operator permissions.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: settings, error } = await supabase
      .from('workspace_entitlements')
      .select('clerk_org_id, org_name, allow_operator_push, duplicate_push_policy, external_agencies_enabled')
      .eq('clerk_org_id', ctx.orgId)
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/org/settings' });
      console.error('Failed to fetch org settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({
      settings: transformKeys(settings)
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/settings' });
    console.error('Failed to get org settings:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

/**
 * PUT /api/org/settings
 *
 * Updates organization settings (admin only).
 */
export async function PUT(request: Request) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { allow_operator_push, duplicate_push_policy, external_agencies_enabled } = body;

    // Validate push policy
    if (duplicate_push_policy && !['block', 'quarantine', 'allow'].includes(duplicate_push_policy)) {
      return NextResponse.json(
        { error: 'Invalid duplicate_push_policy. Must be block, quarantine, or allow.' },
        { status: 400 }
      );
    }

    // Fetch before state for audit log
    const { data: beforeSettings } = await supabase
      .from('workspace_entitlements')
      .select('allow_operator_push, duplicate_push_policy, external_agencies_enabled')
      .eq('clerk_org_id', ctx.orgId)
      .single();

    const updates: any = {};
    if (typeof allow_operator_push === 'boolean') {
      updates.allow_operator_push = allow_operator_push;
    }
    if (duplicate_push_policy) {
      updates.duplicate_push_policy = duplicate_push_policy;
    }
    if (typeof external_agencies_enabled === 'boolean') {
      updates.external_agencies_enabled = external_agencies_enabled;
    }

    const { data: settings, error } = await supabase
      .from('workspace_entitlements')
      .update(updates)
      .eq('clerk_org_id', ctx.orgId)
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/org/settings' });
      console.error('Failed to update org settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    // Audit log (fire and forget)
    logAuditEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'policy_changed',
      metadata: { before: beforeSettings, after: updates },
    });

    return NextResponse.json({
      settings: transformKeys(settings)
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/settings' });
    console.error('Failed to update org settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

/**
 * POST /api/org/settings
 *
 * Creates workspace_entitlements row for new organization.
 */
export async function POST(request: Request) {
  let clerk_org_id: string | undefined;
  let org_name: string | undefined;

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    clerk_org_id = body.clerk_org_id;
    org_name = body.org_name;

    if (!clerk_org_id || !org_name) {
      return NextResponse.json(
        { error: 'clerk_org_id and org_name are required' },
        { status: 400 }
      );
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('workspace_entitlements')
      .select('id')
      .eq('clerk_org_id', clerk_org_id)
      .single();

    if (existing) {
      return NextResponse.json({ message: 'Organization already exists' }, { status: 200 });
    }

    // Create new workspace entitlements
    const { data: settings, error } = await supabase
      .from('workspace_entitlements')
      .insert({
        clerk_org_id,
        org_name,
        allow_operator_push: false,
        duplicate_push_policy: 'block',
        external_agencies_enabled: false,
      })
      .select()
      .single();

    if (error) {
      captureWithOrgContext(error, clerk_org_id, { route: '/api/org/settings' });
      console.error('Failed to create workspace entitlements:', error);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    return NextResponse.json({
      settings: transformKeys(settings)
    }, { status: 201 });
  } catch (error) {
    captureWithOrgContext(error, clerk_org_id || 'unknown', { route: '/api/org/settings' });
    console.error('Failed to create workspace:', error);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
