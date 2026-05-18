import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { AlwaysOnConfig } from '@/lib/always-on/types';

/**
 * GET /api/always-on/config
 *
 * Returns Always On configuration.
 * Creates default row if none exists.
 * Auth: any role
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default';

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Try to get existing config
    let { data: config, error } = await supabase
      .from('always_on_config')
      .select('*')
      .eq('org_id', orgId)
      .single();

    // If no config exists, create default
    if (error && error.code === 'PGRST116') {
      const { data: newConfig, error: createError } = await supabase
        .from('always_on_config')
        .insert({
          org_id: orgId,
          scan_time_utc: '06:00:00',
          digest_enabled: true,
          email_recipients: [],
          slack_enabled: false,
          send_on_no_change: false,
          score_delta_threshold: 3,
          auto_merge_grade_a: false,
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create default config:', createError);
        return NextResponse.json(
          { error: 'Failed to create config' },
          { status: 500 }
        );
      }

      config = newConfig;
    } else if (error) {
      console.error('Failed to fetch config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      config: mapConfigFromDb(config!),
    });
  } catch (error) {
    console.error('Failed to get Always On config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/always-on/config
 *
 * Updates Always On configuration.
 * Auth: admin only (TODO: implement auth check)
 */
export async function PUT(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default';
    const body = await request.json();

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Validate email recipients
    if (body.emailRecipients !== undefined) {
      if (!Array.isArray(body.emailRecipients)) {
        return NextResponse.json(
          { error: 'email_recipients must be an array' },
          { status: 400 }
        );
      }

      if (body.emailRecipients.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 email recipients allowed' },
          { status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of body.emailRecipients) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { error: `Invalid email format: ${email}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate Slack webhook URL
    if (body.slackWebhookUrl !== undefined && body.slackWebhookUrl) {
      if (!body.slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
        return NextResponse.json(
          { error: 'Slack webhook URL must start with https://hooks.slack.com/' },
          { status: 400 }
        );
      }
    }

    // Validate score delta threshold
    if (body.scoreDeltaThreshold !== undefined) {
      const threshold = parseInt(body.scoreDeltaThreshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        return NextResponse.json(
          { error: 'score_delta_threshold must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: any = {};
    if (body.scanTimeUtc !== undefined) updates.scan_time_utc = body.scanTimeUtc;
    if (body.digestEnabled !== undefined) updates.digest_enabled = body.digestEnabled;
    if (body.emailRecipients !== undefined) updates.email_recipients = body.emailRecipients;
    if (body.slackEnabled !== undefined) updates.slack_enabled = body.slackEnabled;
    if (body.slackWebhookUrl !== undefined) updates.slack_webhook_url = body.slackWebhookUrl;
    if (body.sendOnNoChange !== undefined) updates.send_on_no_change = body.sendOnNoChange;
    if (body.scoreDeltaThreshold !== undefined) updates.score_delta_threshold = body.scoreDeltaThreshold;
    if (body.autoMergeGradeA !== undefined) updates.auto_merge_grade_a = body.autoMergeGradeA;

    // Upsert config
    const { data: config, error } = await supabase
      .from('always_on_config')
      .upsert(
        {
          org_id: orgId,
          ...updates,
        },
        {
          onConflict: 'org_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to update config:', error);
      return NextResponse.json(
        { error: 'Failed to update config' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      config: mapConfigFromDb(config),
    });
  } catch (error) {
    console.error('Failed to update Always On config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}

/**
 * Map database config to API format
 */
function mapConfigFromDb(data: any): AlwaysOnConfig {
  return {
    orgId: data.org_id,
    scanTimeUtc: data.scan_time_utc,
    digestEnabled: data.digest_enabled,
    emailRecipients: data.email_recipients || [],
    slackEnabled: data.slack_enabled,
    slackWebhookUrl: data.slack_webhook_url,
    sendOnNoChange: data.send_on_no_change,
    scoreDeltaThreshold: data.score_delta_threshold,
    autoMergeGradeA: data.auto_merge_grade_a,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
