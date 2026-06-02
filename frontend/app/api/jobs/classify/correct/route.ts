/**
 * POST /api/jobs/classify/correct
 *
 * Allows users to correct misclassified job titles.
 * Upserts the correction to job_title_cache with high confidence.
 *
 * Body:
 * - rawTitle: string
 * - level: string
 * - function: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { rawTitle, level, function: fn } = body;

    if (!rawTitle || !level || !fn) {
      return NextResponse.json(
        { error: 'Missing required fields: rawTitle, level, function' },
        { status: 400 }
      );
    }

    // Upsert to cache with user-provided values
    const { error } = await supabaseAdmin
      .from('job_title_cache')
      .upsert(
        {
          raw_title: rawTitle,
          job_level: level,
          job_function: fn,
          confidence: 'high', // User corrections always high confidence
        },
        { onConflict: 'raw_title' }
      );

    if (error) {
      console.error('[Correction] Failed to save:', error);
      return NextResponse.json(
        { error: 'Failed to save correction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Correction] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
