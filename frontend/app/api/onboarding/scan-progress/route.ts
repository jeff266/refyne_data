import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface ScanProgressEvent {
  id: string;
  eventType: string;
  message: string;
  count?: number;
  createdAt: string;
}

/**
 * GET /api/onboarding/scan-progress
 *
 * Returns all scan progress events for a run
 * Auth: any role
 * Query: runId
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      );
    }

    // Fetch all events for this run
    const { data: events, error: eventsError } = await supabase
      .from('scan_progress_events')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (eventsError) {
      captureWithOrgContext(eventsError, ctx.orgId, { route: '/api/onboarding/scan-progress' });
      console.error('Failed to fetch scan progress events:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch scan progress' },
        { status: 500 }
      );
    }

    // Check if scan is completed
    const completed = events?.some(e => e.event_type === 'completed') ?? false;

    // Extract score if available
    const scoreEvent = events?.find(e => e.event_type === 'score_calculated');
    let score: number | undefined;

    if (scoreEvent?.message) {
      const match = scoreEvent.message.match(/(\d+)\/100/);
      if (match) {
        score = parseInt(match[1], 10);
      }
    }

    // Transform events to camelCase
    const transformedEvents: ScanProgressEvent[] = (events || []).map(e => ({
      id: e.id,
      eventType: e.event_type,
      message: e.message,
      count: e.count,
      createdAt: e.created_at,
    }));

    return NextResponse.json({
      events: transformedEvents,
      completed,
      score,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/onboarding/scan-progress' });
    console.error('Failed to fetch scan progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan progress' },
      { status: 500 }
    );
  }
}
