import { NextRequest, NextResponse } from 'next/server';
import { sendWorkerAlert } from '@/lib/monitoring/alert';

/**
 * POST /api/webhooks/worker-health
 *
 * Coolify container lifecycle webhook.
 * Receives notifications when the worker container restarts or stops.
 *
 * No Clerk auth - verified via webhook secret header.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.WORKER_HEALTH_SECRET || 'Zt/W7WiEtVBFNbEBMrm12iS9RZ2HW/vob55TnuxP2N4=';

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event, service } = body;

    if (!event || !service) {
      return NextResponse.json(
        { error: 'Missing event or service' },
        { status: 400 }
      );
    }

    // Send alert for container lifecycle events
    const eventLabels: Record<string, string> = {
      container_restart: 'Container Restarted',
      container_stop: 'Container Stopped',
      container_start: 'Container Started',
    };

    const subject = eventLabels[event] ?? `Unknown Event: ${event}`;
    const body_text = `
      Service: ${service}
      Event: ${event}

      The worker container has experienced a lifecycle event.
      Check Coolify logs if this was unexpected.
    `;

    await sendWorkerAlert(subject, body_text);

    console.log(`[Worker Health Webhook] ${event} event received for ${service}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Worker Health Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/worker-health
 *
 * Health check endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'Worker health webhook endpoint',
  });
}
