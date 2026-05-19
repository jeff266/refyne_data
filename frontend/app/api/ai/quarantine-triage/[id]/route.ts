import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { generateSummary } from '@/lib/ai/claude-client';
import { getCachedSummary, setCachedSummary } from '@/lib/ai/cache';
import {
  QUARANTINE_TRIAGE_SYSTEM,
  buildQuarantinePrompt,
  type QuarantineInput,
  type QuarantineOutput,
} from '@/lib/ai/prompts/quarantine-triage';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/ai/quarantine-triage/:id
 *
 * Generates AI analysis for a quarantine record to assist with triage.
 * Explains why records were flagged and provides recommendation.
 *
 * Auth: org:admin only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const quarantineId = params.id;
    const cacheKey = `ai:quarantine:${quarantineId}`;

    // Step 1: Check Upstash cache (TTL 24 hours)
    const cached = await getCachedSummary<QuarantineOutput>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Step 2: Fetch quarantine record
    const { data: quarantine, error: qError } = await supabase
      .from('quarantine_records')
      .select('*')
      .eq('id', quarantineId)
      .single();

    if (qError || !quarantine) {
      return NextResponse.json(
        { error: 'Quarantine record not found' },
        { status: 404 }
      );
    }

    // Verify org ownership
    if (quarantine.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Step 3: Fetch existing HubSpot record if duplicate_of is set
    let existingRecord = null;
    if (quarantine.duplicate_of) {
      // Fetch from HubSpot or cached data
      // For now, using record_data as proxy
      existingRecord = {
        name: quarantine.duplicate_of,
        domain: null,
        industry: null,
        employeeCount: null,
        linkedinUrl: null,
        createdDaysAgo: 30, // Placeholder
      };
    }

    // Step 4: Build input data
    const submittedData = quarantine.record_data as Record<string, unknown>;
    const inputData: QuarantineInput = {
      submitted: {
        name: (submittedData.name as string) || 'Unknown',
        domain: submittedData.domain as string | undefined,
        industry: submittedData.industry as string | undefined,
        employeeCount: submittedData.employeeCount as number | undefined,
        linkedinUrl: submittedData.linkedinUrl as string | undefined,
      },
      existing: existingRecord || {
        name: 'Unknown',
        createdDaysAgo: 0,
      },
      submitterName: quarantine.submitted_name || 'Unknown user',
      submitterRole: 'operator', // Could fetch from user metadata
      signals: (quarantine.signals_fired as string[]) || [],
      confidence: quarantine.confidence || 0,
      grade: quarantine.confidence && quarantine.confidence > 90 ? 'A' : 'B',
    };

    // Step 5: Generate via Claude
    const userPrompt = buildQuarantinePrompt(inputData);
    const output = await generateSummary<QuarantineOutput>(
      QUARANTINE_TRIAGE_SYSTEM,
      userPrompt,
      ctx.orgId,
      'quarantine_triage',
      inputData
    );

    // Step 6: Cache in Upstash (TTL 24 hours)
    await setCachedSummary(cacheKey, output, 86400);

    return NextResponse.json(output);
  } catch (error) {
    console.error('[AI Quarantine Triage] Error:', error);
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/ai/quarantine-triage/:id',
      severity: 'warning',
    });

    return NextResponse.json(
      { error: 'Failed to generate triage analysis' },
      { status: 500 }
    );
  }
}
