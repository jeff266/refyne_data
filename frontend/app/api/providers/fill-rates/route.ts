import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/providers/fill-rates
 *
 * Returns historical fill rate per provider per field.
 * Used for waterfall builder fill rate estimates.
 *
 * Returns: { [provider]: { [field]: fill_rate } }
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Industry-average fill rates (seeded defaults)
    // TODO: Replace with actual historical data from arrangement_runs table
    const fillRates = {
      apollo: {
        industry: 0.82,
        phone: 0.71,
        revenue: 0.68,
        employee_count: 0.65,
        domain: 0.88,
        company_type: 0.45,
        description: 0.72,
        technologies: 0.38,
      },
      clearbit: {
        industry: 0.58,
        phone: 0.42,
        revenue: 0.51,
        employee_count: 0.63,
        domain: 0.88,
        company_type: 0.67,
        description: 0.55,
        technologies: 0.28,
      },
      zoominfo: {
        industry: 0.78,
        phone: 0.82,
        revenue: 0.75,
        employee_count: 0.80,
        domain: 0.85,
        company_type: 0.52,
        description: 0.68,
        technologies: 0.71,
      },
      serper: {
        industry: 0.38,
        phone: 0.45,
        revenue: 0.22,
        employee_count: 0.18,
        domain: 0.92,
        company_type: 0.35,
        description: 0.78,
        technologies: 0.15,
      },
    };

    // Calculate aggregate coverage (base coverage %)
    const coverage = {
      apollo: 0.70,
      clearbit: 0.60,
      zoominfo: 0.75,
      serper: 0.40,
    };

    return NextResponse.json({
      fillRates,
      coverage,
    });
  } catch (error) {
    console.error('[fill-rates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get fill rates' },
      { status: 500 }
    );
  }
}
