import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { deductEnrichCredit } from '@/lib/billing/check-feature';
import { GraphiqAdapter } from '@/lib/providers/graphiq';
import type { CompanyQuery, SearchQuery } from '@/lib/providers/types';

/**
 * POST /api/enrich/providers/graphiq
 *
 * Server-side GraphIQ enrichment with credit metering.
 * Prevents exposing GraphIQ API key to client.
 *
 * Body: {
 *   action: 'enrichCompany' | 'search',
 *   query: CompanyQuery | SearchQuery
 * }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, query } = body;

    if (!action || !query) {
      return NextResponse.json(
        { error: 'action and query are required' },
        { status: 400 }
      );
    }

    if (!['enrichCompany', 'search'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be enrichCompany or search' },
        { status: 400 }
      );
    }

    // Deduct credit before making API call
    const creditResult = await deductEnrichCredit(
      ctx.orgId,
      ctx.userId,
      action,
      'graphiq',
      1
    );

    if (!creditResult.allowed) {
      return NextResponse.json(
        {
          error: 'Credit limit reached',
          remaining: creditResult.remaining,
        },
        { status: 429 }
      );
    }

    // Make GraphIQ API call
    const provider = new GraphiqAdapter();
    let result;

    if (action === 'enrichCompany') {
      result = await provider.enrichCompany(query as CompanyQuery);
    } else {
      result = await provider.search(query as SearchQuery);
    }

    return NextResponse.json({
      success: true,
      data: result,
      creditsRemaining: creditResult.remaining,
    });
  } catch (error: any) {
    console.error('[GraphIQ API] Error:', error);

    // Handle provider-specific errors
    if (error.provider === 'graphiq') {
      return NextResponse.json(
        {
          error: 'Provider error',
          code: error.code,
          message: error.message,
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch data from GraphIQ' },
      { status: 500 }
    );
  }
}
