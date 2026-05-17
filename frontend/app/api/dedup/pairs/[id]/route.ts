import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowToPair, type DedupPairRow } from '@/lib/dedup/types';

/**
 * GET /api/dedup/pairs/:id
 *
 * Returns a single pair with basic record data.
 * Note: Live HubSpot data fetch requires decryption of stored token.
 * For now, returns record IDs only. UI handles missing data gracefully.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = request.headers.get('x-org-id') || 'default';

    // Get pair
    const { data: pair, error: pairError } = await supabase
      .from('dedup_pairs')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (pairError || !pair) {
      return NextResponse.json(
        { error: 'Pair not found' },
        { status: 404 }
      );
    }

    const pairData = rowToPair(pair as DedupPairRow);

    // Try to get cached/normalized record data from normalized_records table
    let recordAData: Record<string, unknown> | null = null;
    let recordBData: Record<string, unknown> | null = null;

    // Check for normalized records (from previous sync)
    const { data: normalizedRecords } = await supabase
      .from('normalized_records')
      .select('hubspot_id, canonical')
      .eq('org_id', orgId)
      .in('hubspot_id', [pairData.recordAId, pairData.recordBId]);

    if (normalizedRecords) {
      for (const rec of normalizedRecords) {
        if (rec.hubspot_id === pairData.recordAId) {
          recordAData = rec.canonical as Record<string, unknown>;
        } else if (rec.hubspot_id === pairData.recordBId) {
          recordBData = rec.canonical as Record<string, unknown>;
        }
      }
    }

    return NextResponse.json({
      pair: pairData,
      recordAData,
      recordBData,
    });
  } catch (error) {
    console.error('Failed to get dedup pair:', error);
    return NextResponse.json(
      { error: 'Failed to get pair' },
      { status: 500 }
    );
  }
}
