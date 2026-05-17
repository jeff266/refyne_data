/**
 * HubSpot Webhook Endpoint
 *
 * POST /api/webhooks/hubspot
 *
 * H4: Webhook + Real-Time
 *
 * Handles incoming HubSpot webhook events:
 * - Validates signature (v1 or v3)
 * - Responds 200 immediately (HubSpot requirement)
 * - Enqueues events to BullMQ for async processing
 * - Deduplicates at both handler and queue level
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSignatureV1,
  validateSignatureV3,
} from '../../../../lib/hubspot/webhook-handler';
import {
  enqueueWebhookBatch,
  getQueueStats,
  getWorkerConcurrency,
  getRateLimitSettings,
} from '../../../../lib/queue/webhook-queue';
import { isRedisConfigured } from '../../../../lib/queue/redis';
import type { HubSpotWebhookEvent, NormalizationMode } from '../../../../lib/hubspot/write-types';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

// In production, these would be fetched from database/env per org
interface OrgConfig {
  clientSecret: string;
  accessToken: string;
  mode: NormalizationMode;
}

// Get org config by portal ID
// In production, this would query hubspot_connections table
async function getOrgConfigByPortalId(portalId: string): Promise<OrgConfig | null> {
  // Check environment variables for known portals
  const fronteraPortalId = '49169539';
  const growthbookPortalId = '8863617';

  if (portalId === fronteraPortalId) {
    const token = process.env.HUBSPOT_TOKEN_FRONTERA || process.env.HUBSPOT_TOKEN;
    const secret = process.env.HUBSPOT_CLIENT_SECRET_FRONTERA || process.env.HUBSPOT_CLIENT_SECRET;
    if (token) {
      return {
        clientSecret: secret || '',
        accessToken: token,
        mode: 'implicit', // Default to implicit for known portals
      };
    }
  }

  if (portalId === growthbookPortalId) {
    const token = process.env.HUBSPOT_TOKEN_GROWTHBOOK;
    const secret = process.env.HUBSPOT_CLIENT_SECRET_GROWTHBOOK || process.env.HUBSPOT_CLIENT_SECRET;
    if (token) {
      return {
        clientSecret: secret || '',
        accessToken: token,
        mode: 'implicit',
      };
    }
  }

  // Fallback to generic env vars
  const token = process.env.HUBSPOT_TOKEN;
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (token) {
    return {
      clientSecret: secret || '',
      accessToken: token,
      mode: 'implicit',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Webhook Handler
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Read raw body for signature validation
    const rawBody = await request.text();

    // Get signature headers
    const signatureV3 = request.headers.get('X-HubSpot-Signature-v3');
    const signatureV1 = request.headers.get('X-HubSpot-Signature');
    const timestamp = request.headers.get('X-HubSpot-Request-Timestamp');

    // Parse events
    let events: HubSpotWebhookEvent[];
    try {
      events = JSON.parse(rawBody);
      if (!Array.isArray(events)) {
        events = [events];
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    if (events.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Get portal ID from first event
    const portalId = String(events[0].portalId);

    // Look up org config
    const orgConfig = await getOrgConfigByPortalId(portalId);

    if (!orgConfig) {
      console.warn(`No config found for HubSpot portal: ${portalId}`);
      // Still return 200 to prevent HubSpot retries for unconfigured portals
      return NextResponse.json({
        error: 'Portal not configured',
        portalId,
      });
    }

    // Validate signature if client secret is configured
    if (orgConfig.clientSecret) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.url}/api/webhooks/hubspot`;

      // Try v3 signature first (preferred), then v1
      let signatureValid = false;

      if (signatureV3 && timestamp) {
        signatureValid = validateSignatureV3(
          orgConfig.clientSecret,
          'POST',
          webhookUrl,
          rawBody,
          timestamp,
          signatureV3
        );
      } else if (signatureV1) {
        signatureValid = validateSignatureV1(
          orgConfig.clientSecret,
          rawBody,
          signatureV1
        );
      }

      if (!signatureValid && (signatureV3 || signatureV1)) {
        console.warn('Invalid HubSpot webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const orgId = `portal-${portalId}`;

    // Check if queue is available
    if (!isRedisConfigured()) {
      console.warn('Redis not configured - webhook events will not be processed');
      return NextResponse.json({
        warning: 'Queue not configured',
        received: events.length,
        queued: 0,
      });
    }

    // Enqueue events to BullMQ (returns immediately)
    const { queued, duplicates, errors } = await enqueueWebhookBatch(
      events,
      orgId,
      orgConfig.accessToken,
      orgConfig.mode
    );

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      received: events.length,
      queued,
      duplicates,
      errors,
      durationMs,
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    // Still return 200 to prevent HubSpot retries
    return NextResponse.json({
      error: 'Internal error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Health check and stats endpoint
export async function GET() {
  const stats = await getQueueStats();
  const concurrency = getWorkerConcurrency();
  const rateLimit = getRateLimitSettings();

  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/hubspot',
    supportedEvents: ['company.creation', 'company.propertyChange'],
    queue: {
      enabled: isRedisConfigured(),
      concurrency,
      rateLimit: `${rateLimit.max} jobs per ${rateLimit.duration / 1000}s`,
      stats: stats || 'Queue not configured',
    },
  });
}
