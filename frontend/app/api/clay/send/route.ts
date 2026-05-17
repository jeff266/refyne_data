import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// In-memory store for pending requests (use Redis in production)
// Note: In production, use a shared store like Redis since this is instance-local
const pendingRequests = new Map<string, {
  requestId: string;
  records: any[];
  sentAt: Date;
  status: 'pending' | 'received' | 'timeout' | 'error';
  receivedAt?: Date;
  enrichedRecords?: any[];
  error?: string;
}>();

// Make available globally for webhook receiver (same process)
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__clayPendingRequests = pendingRequests;
}

function generateRequestId(): string {
  const content = Date.now().toString() + Math.random().toString();
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId: providedRequestId, records, webhookUrl, callbackUrl } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Records array is required' },
        { status: 400 }
      );
    }

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'webhookUrl is required' },
        { status: 400 }
      );
    }

    const requestId = providedRequestId || generateRequestId();

    // Prepare payload for Clay
    const payload = {
      request_id: requestId,
      callback_url: callbackUrl,
      sent_at: new Date().toISOString(),
      source: 'enrichment-switcher',
      records: records.map((record, index) => ({
        ...record,
        _row_index: index,
        _request_id: requestId,
      })),
    };

    // Send to Clay
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Clay webhook error:', errorText);
      return NextResponse.json(
        { error: 'Failed to send to Clay', details: errorText },
        { status: response.status }
      );
    }

    // Track pending request
    pendingRequests.set(requestId, {
      requestId,
      records,
      sentAt: new Date(),
      status: 'pending',
    });

    return NextResponse.json({
      success: true,
      requestId,
      recordsSent: records.length,
      status: 'pending',
      callbackUrl,
    });

  } catch (error) {
    console.error('Error sending to Clay:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check status of sent requests
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('request_id');

  if (!requestId) {
    // Return all pending
    const pending = Array.from(pendingRequests.entries()).map(([id, data]) => ({
      requestId: id,
      recordCount: data.records.length,
      sentAt: data.sentAt.toISOString(),
      status: data.status,
    }));

    return NextResponse.json({ pending });
  }

  const pendingRequest = pendingRequests.get(requestId);

  if (!pendingRequest) {
    return NextResponse.json(
      { error: 'Request not found', requestId, status: 'not_found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    requestId: pendingRequest.requestId,
    recordCount: pendingRequest.records.length,
    sentAt: pendingRequest.sentAt.toISOString(),
    status: pendingRequest.status,
    receivedAt: pendingRequest.receivedAt?.toISOString(),
    enrichedRecords: pendingRequest.enrichedRecords,
    error: pendingRequest.error,
  });
}
