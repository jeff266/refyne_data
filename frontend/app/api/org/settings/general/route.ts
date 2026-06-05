import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface GeneralSettings {
  workspaceName: string | null;
  displayName: string | null;
  timezone: string;
  alwaysOn: {
    enabled: boolean;
    digestTime: string;
    scoreThreshold: number;
    sendOnNoChange: boolean;
    emailRecipients: string[];
  } | null;
}

/**
 * GET /api/org/settings/general
 *
 * Get general workspace settings.
 * Auth: admin only
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get workspace settings
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspace_entitlements')
      .select('org_name, display_name, timezone')
      .eq('org_id', ctx.orgId)
      .single();

    if (workspaceError) {
      captureWithOrgContext(workspaceError, ctx.orgId, { route: '/api/org/settings/general' });
      return NextResponse.json(
        { error: 'Failed to fetch workspace settings' },
        { status: 500 }
      );
    }

    // Get Always On config
    const { data: alwaysOnConfig, error: alwaysOnError } = await supabase
      .from('always_on_config')
      .select('digest_enabled, scan_time_utc, score_delta_threshold, send_on_no_change, email_recipients')
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    if (alwaysOnError) {
      captureWithOrgContext(alwaysOnError, ctx.orgId, { route: '/api/org/settings/general' });
      // Non-fatal - continue without Always On config
    }

    const settings: GeneralSettings = {
      workspaceName: workspace.org_name || null,
      displayName: workspace.display_name || null,
      timezone: workspace.timezone || 'UTC',
      alwaysOn: alwaysOnConfig ? {
        enabled: alwaysOnConfig.digest_enabled ?? false,
        digestTime: alwaysOnConfig.scan_time_utc || '06:00:00',
        scoreThreshold: alwaysOnConfig.score_delta_threshold || 3,
        sendOnNoChange: alwaysOnConfig.send_on_no_change ?? false,
        emailRecipients: alwaysOnConfig.email_recipients || [],
      } : null,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/settings/general' });
    console.error('Failed to get general settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/settings/general
 *
 * Update general workspace settings.
 * Auth: admin only
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      workspaceName,
      displayName,
      timezone,
      digestTime,
      scoreThreshold,
      sendOnNoChange,
      emailRecipients,
    } = body;

    // Update workspace settings if provided
    if (workspaceName !== undefined || displayName !== undefined || timezone !== undefined) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (workspaceName !== undefined) {
        updates.org_name = workspaceName;
      }
      if (displayName !== undefined) {
        updates.display_name = displayName;
      }
      if (timezone !== undefined) {
        updates.timezone = timezone;
      }

      const { error: workspaceError } = await supabase
        .from('workspace_entitlements')
        .update(updates)
        .eq('org_id', ctx.orgId);

      if (workspaceError) {
        captureWithOrgContext(workspaceError, ctx.orgId, { route: '/api/org/settings/general' });
        return NextResponse.json(
          { error: 'Failed to update workspace settings' },
          { status: 500 }
        );
      }
    }

    // Update Always On config if provided
    if (digestTime !== undefined || scoreThreshold !== undefined || sendOnNoChange !== undefined || emailRecipients !== undefined) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (digestTime !== undefined) {
        updates.scan_time_utc = digestTime;
      }
      if (scoreThreshold !== undefined) {
        updates.score_delta_threshold = scoreThreshold;
      }
      if (sendOnNoChange !== undefined) {
        updates.send_on_no_change = sendOnNoChange;
      }
      if (emailRecipients !== undefined) {
        updates.email_recipients = emailRecipients;
      }

      const { error: alwaysOnError } = await supabase
        .from('always_on_config')
        .update(updates)
        .eq('org_id', ctx.orgId);

      if (alwaysOnError) {
        captureWithOrgContext(alwaysOnError, ctx.orgId, { route: '/api/org/settings/general' });
        return NextResponse.json(
          { error: 'Failed to update Always On settings' },
          { status: 500 }
        );
      }
    }

    // Fetch and return updated settings
    const { data: workspace } = await supabase
      .from('workspace_entitlements')
      .select('org_name, display_name, timezone')
      .eq('org_id', ctx.orgId)
      .single();

    const { data: alwaysOnConfig } = await supabase
      .from('always_on_config')
      .select('digest_enabled, scan_time_utc, score_delta_threshold, send_on_no_change, email_recipients')
      .eq('org_id', ctx.orgId)
      .maybeSingle();

    const settings: GeneralSettings = {
      workspaceName: workspace?.org_name || null,
      displayName: workspace?.display_name || null,
      timezone: workspace?.timezone || 'UTC',
      alwaysOn: alwaysOnConfig ? {
        enabled: alwaysOnConfig.digest_enabled ?? false,
        digestTime: alwaysOnConfig.scan_time_utc || '06:00:00',
        scoreThreshold: alwaysOnConfig.score_delta_threshold || 3,
        sendOnNoChange: alwaysOnConfig.send_on_no_change ?? false,
        emailRecipients: alwaysOnConfig.email_recipients || [],
      } : null,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/settings/general' });
    console.error('Failed to update general settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
