import { NextRequest, NextResponse } from 'next/server';
import { authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { createClient } from 'redis';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * GET /api/jobs/[jobId]/results
 *
 * Returns the cached preview results for a completed preview job.
 * Results are stored in Redis with 10-minute TTL.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { jobId } = params;

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
  }

  try {
    if (!REDIS_URL || !REDIS_TOKEN) {
      return NextResponse.json(
        { error: 'Redis not configured' },
        { status: 503 }
      );
    }

    const redis = createClient({
      url: REDIS_URL,
      password: REDIS_TOKEN,
    });

    await redis.connect();

    // Get full results
    const cached = await redis.get(`preview:${jobId}:results`);

    if (!cached) {
      await redis.quit();
      return NextResponse.json(
        { error: 'Results not found or expired' },
        { status: 404 }
      );
    }

    const results = JSON.parse(cached);

    // Also get partial results count for progressive rendering
    const partialCount = await redis.lLen(`preview:${jobId}:partial`);

    await redis.quit();

    return NextResponse.json({
      results,
      totalCount: results.length,
      partialCount,
    });
  } catch (error) {
    console.error('[Job Results] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get job results',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
