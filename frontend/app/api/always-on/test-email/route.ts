import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { sendDigestEmail } from '@/lib/always-on/send-digest';
import type { DigestPayload } from '@/lib/always-on/types';
import type { AlwaysOnTestEmailResponse } from '@/lib/always-on/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/always-on/test-email
 *
 * Sends a test digest email to the requesting user.
 * Uses last digest_payload if available, else synthetic data.
 * Auth: admin only (TODO: implement auth check)
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;

    // TODO: Get requesting user's email from auth
    // For now, use a test email or the first recipient in config
    const testEmail = request.headers.get('x-user-email') || 'test@example.com';

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Try to get last digest payload
    const { data: lastRun } = await supabase
      .from('digest_runs')
      .select('digest_payload')
      .eq('org_id', orgId)
      .not('digest_payload', 'is', null)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    // Use last payload or create synthetic one
    const payload: DigestPayload = lastRun?.digest_payload || createSyntheticPayload();

    // Send test email
    await sendDigestEmail(payload, [testEmail], orgId);

    return NextResponse.json({
      sent: true,
      recipient: testEmail,
    } as AlwaysOnTestEmailResponse);
  } catch (error) {
    console.error('Failed to send test email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email' },
      { status: 500 }
    );
  }
}

/**
 * Create synthetic digest payload for testing.
 */
function createSyntheticPayload(): DigestPayload {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://refyne.io';

  return {
    portalName: 'Test Portal',
    digestDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    score: 85,
    scoreDelta: 3,
    remediationItems: [
      {
        rank: 1,
        harmony: 'company-industry',
        harmonyId: 'company-industry',
        issue: '82 unmatched records',
        recordsAffected: 82,
        actionLabel: 'Fix in Harmonies',
        actionUrl: `${baseUrl}/harmonies`,
      },
      {
        rank: 2,
        harmony: 'phone-e164',
        harmonyId: 'phone-e164',
        issue: '45 invalid formats',
        recordsAffected: 45,
        actionLabel: 'Review records',
        actionUrl: `${baseUrl}/normalize`,
      },
    ],
    harmonyBreakdown: [
      { name: 'Company Name', harmonyId: 'company-name', score: 98, delta: 0 },
      { name: 'Company Industry', harmonyId: 'company-industry', score: 72, delta: -3 },
      { name: 'Phone E164', harmonyId: 'phone-e164', score: 88, delta: 2 },
    ],
    dedupSummary: {
      newPairs: 12,
      gradeA: 5,
      gradeB: 4,
      gradeC: 2,
      gradeD: 1,
    },
    newInsightsCount: 3,
    dashboardUrl: `${baseUrl}/dashboard`,
    dedupUrl: `${baseUrl}/dedup`,
    settingsUrl: `${baseUrl}/settings`,
  };
}
