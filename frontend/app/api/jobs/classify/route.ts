/**
 * POST /api/jobs/classify
 *
 * Classifies job titles into level + function using Claude Haiku.
 * Used for previewing job title segmentation before creating arrangements.
 *
 * Request body:
 * {
 *   "titles": ["CEO", "Clinical Director", "BCBA", ...]
 * }
 *
 * Response:
 * {
 *   "results": [
 *     { "title": "CEO", "level": "C-Suite", "function": "Executive", "confidence": "high" },
 *     { "title": "Clinical Director", "level": "Director", "function": "Clinical/Healthcare", "confidence": "high" },
 *     ...
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { classifyJobTitleBatch } from '@/lib/harmonies/job-title-classifier';
import { requireAdmin } from '@/lib/auth/roles';

export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    requireAdmin(ctx.orgRole);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  try {
    const { titles } = await request.json();

    if (!Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json({ error: 'titles array required' }, { status: 400 });
    }

    // Limit to 50 for preview
    const limited = titles.slice(0, 50);
    const classifications = await classifyJobTitleBatch(limited);

    const results = limited.map((title) => ({
      title,
      level: classifications.get(title)?.level ?? 'Other',
      function: classifications.get(title)?.function ?? 'Other',
      confidence: classifications.get(title)?.confidence ?? 'low',
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Job classification error:', error);
    return NextResponse.json(
      { error: 'Failed to classify job titles' },
      { status: 500 }
    );
  }
}
