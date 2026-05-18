import { NextRequest, NextResponse } from 'next/server';
import { getAlertConfig, saveAlertConfig, type AlertConfig } from '@/lib/compliance';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/compliance/alerts
 *
 * Returns alert configuration for the organization.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;

    const config = await getAlertConfig(orgId);

    // Return default config if none exists
    if (!config) {
      return NextResponse.json({
        scoreThreshold: null,
        harmonyThreshold: null,
        unprocessedThreshold: null,
        notifyEmail: true,
        notifySlackWebhook: null,
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to get alert config:', error);
    return NextResponse.json(
      { error: 'Failed to get alert configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/alerts
 *
 * Upsert alert configuration.
 * Body: AlertConfig
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const body = await request.json();
    const config = body;
    const orgId = ctx.orgId;

    // Validate thresholds
    if (config.scoreThreshold !== null && config.scoreThreshold !== undefined) {
      if (config.scoreThreshold < 0 || config.scoreThreshold > 100) {
        return NextResponse.json(
          { error: 'scoreThreshold must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    if (config.harmonyThreshold !== null && config.harmonyThreshold !== undefined) {
      if (config.harmonyThreshold < 0 || config.harmonyThreshold > 100) {
        return NextResponse.json(
          { error: 'harmonyThreshold must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    if (config.unprocessedThreshold !== null && config.unprocessedThreshold !== undefined) {
      if (config.unprocessedThreshold < 0) {
        return NextResponse.json(
          { error: 'unprocessedThreshold must be >= 0' },
          { status: 400 }
        );
      }
    }

    const alertConfig: AlertConfig = {
      scoreThreshold: config.scoreThreshold ?? null,
      harmonyThreshold: config.harmonyThreshold ?? null,
      unprocessedThreshold: config.unprocessedThreshold ?? null,
      notifyEmail: config.notifyEmail ?? true,
      notifySlackWebhook: config.notifySlackWebhook ?? null,
    };

    await saveAlertConfig(orgId, alertConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save alert config:', error);
    return NextResponse.json(
      { error: 'Failed to save alert configuration' },
      { status: 500 }
    );
  }
}
