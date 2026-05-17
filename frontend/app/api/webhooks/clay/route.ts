import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

// Type for pending request
interface PendingRequest {
  requestId: string;
  records: any[];
  sentAt: Date;
  status: 'pending' | 'received' | 'timeout' | 'error';
  receivedAt?: Date;
  enrichedRecords?: any[];
  error?: string;
}

// Get pending requests from global store (shared with send route)
// In production, this would be Redis/DB
function getPendingRequests(): Map<string, PendingRequest> {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__clayPendingRequests) {
    return (globalThis as any).__clayPendingRequests;
  }
  // Fallback to local map if global not available
  const fallbackMap = new Map<string, PendingRequest>();
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__clayPendingRequests = fallbackMap;
  }
  return fallbackMap;
}

// Verify Clay webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.CLAY_WEBHOOK_SECRET;

  if (!secret) {
    // No secret configured - allow in development
    console.warn('CLAY_WEBHOOK_SECRET not set - skipping signature verification');
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-clay-signature');

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      console.warn('Invalid Clay webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);

    // Extract request ID and enriched data
    const {
      request_id: requestId,
      records,
      metadata,
    } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'Missing request_id' },
        { status: 400 }
      );
    }

    const receivedAt = new Date();

    // Update pending request if it exists
    const pendingRequest = getPendingRequests().get(requestId);
    if (pendingRequest) {
      pendingRequest.status = 'received';
      pendingRequest.receivedAt = receivedAt;
      pendingRequest.enrichedRecords = records || [];
    } else {
      // Store even if we didn't have it tracked (could be from different session)
      getPendingRequests().set(requestId, {
        requestId,
        records: [],
        sentAt: receivedAt, // Unknown original send time
        status: 'received',
        receivedAt,
        enrichedRecords: records || [],
      });
    }

    console.log(`Received Clay webhook for request ${requestId}: ${records?.length || 0} records`);

    return NextResponse.json({
      success: true,
      requestId,
      recordsReceived: records?.length || 0,
      message: 'Enrichment data received',
    });

  } catch (error) {
    console.error('Clay webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check enrichment status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('request_id');

  if (!requestId) {
    // Return all received enrichments
    const all = Array.from(getPendingRequests().entries())
      .filter(([_, data]) => data.status === 'received')
      .map(([id, data]) => ({
        requestId: id,
        recordCount: data.enrichedRecords?.length || 0,
        receivedAt: data.receivedAt?.toISOString(),
      }));

    return NextResponse.json({ enrichments: all });
  }

  const enrichment = getPendingRequests().get(requestId);

  if (!enrichment) {
    return NextResponse.json(
      {
        error: 'Enrichment not found',
        requestId,
        status: 'not_found',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    requestId: enrichment.requestId,
    status: enrichment.status,
    records: enrichment.enrichedRecords,
    recordCount: enrichment.enrichedRecords?.length || 0,
    sentAt: enrichment.sentAt?.toISOString(),
    receivedAt: enrichment.receivedAt?.toISOString(),
    durationMs: enrichment.receivedAt && enrichment.sentAt
      ? enrichment.receivedAt.getTime() - enrichment.sentAt.getTime()
      : null,
  });
}
