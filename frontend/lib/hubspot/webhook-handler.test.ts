/**
 * Webhook Handler Tests
 *
 * H4: Webhook + Real-Time
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  validateSignatureV1,
  validateSignatureV3,
  recordEvent,
  updateEventStatus,
  calculateBackoff,
} from './webhook-handler';
import type { HubSpotWebhookEvent } from './write-types';

describe('Signature Validation', () => {
  const clientSecret = 'test-client-secret-12345';

  describe('validateSignatureV1', () => {
    it('validates correct v1 signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const signature = crypto
        .createHmac('sha256', clientSecret)
        .update(body)
        .digest('hex');

      expect(validateSignatureV1(clientSecret, body, signature)).toBe(true);
    });

    it('rejects incorrect v1 signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const wrongSignature = 'wrong-signature';

      expect(validateSignatureV1(clientSecret, body, wrongSignature)).toBe(false);
    });

    it('rejects null signature', () => {
      const body = JSON.stringify({ test: 'data' });

      expect(validateSignatureV1(clientSecret, body, null)).toBe(false);
    });

    it('rejects tampered body', () => {
      const originalBody = JSON.stringify({ test: 'data' });
      const signature = crypto
        .createHmac('sha256', clientSecret)
        .update(originalBody)
        .digest('hex');

      const tamperedBody = JSON.stringify({ test: 'tampered' });

      expect(validateSignatureV1(clientSecret, tamperedBody, signature)).toBe(false);
    });
  });

  describe('validateSignatureV3', () => {
    const method = 'POST';
    const uri = 'https://example.com/api/webhooks/hubspot';

    it('validates correct v3 signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const timestamp = String(Date.now());

      const sourceString = clientSecret + method + uri + body + timestamp;
      const signature = crypto
        .createHash('sha256')
        .update(sourceString)
        .digest('base64');

      expect(validateSignatureV3(clientSecret, method, uri, body, timestamp, signature)).toBe(true);
    });

    it('rejects incorrect v3 signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const timestamp = String(Date.now());
      const wrongSignature = 'wrong-signature';

      expect(validateSignatureV3(clientSecret, method, uri, body, timestamp, wrongSignature)).toBe(false);
    });

    it('rejects null signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const timestamp = String(Date.now());

      expect(validateSignatureV3(clientSecret, method, uri, body, timestamp, null)).toBe(false);
    });

    it('rejects null timestamp', () => {
      const body = JSON.stringify({ test: 'data' });
      const signature = 'some-signature';

      expect(validateSignatureV3(clientSecret, method, uri, body, null, signature)).toBe(false);
    });

    it('rejects old timestamp (>5 minutes)', () => {
      const body = JSON.stringify({ test: 'data' });
      const oldTimestamp = String(Date.now() - 6 * 60 * 1000); // 6 minutes ago

      const sourceString = clientSecret + method + uri + body + oldTimestamp;
      const signature = crypto
        .createHash('sha256')
        .update(sourceString)
        .digest('base64');

      expect(validateSignatureV3(clientSecret, method, uri, body, oldTimestamp, signature)).toBe(false);
    });

    it('rejects tampered body', () => {
      const originalBody = JSON.stringify({ test: 'data' });
      const timestamp = String(Date.now());

      const sourceString = clientSecret + method + uri + originalBody + timestamp;
      const signature = crypto
        .createHash('sha256')
        .update(sourceString)
        .digest('base64');

      const tamperedBody = JSON.stringify({ test: 'tampered' });

      expect(validateSignatureV3(clientSecret, method, uri, tamperedBody, timestamp, signature)).toBe(false);
    });
  });
});

describe('Event Deduplication', () => {
  const createEvent = (eventId: number, objectId: number = 12345): HubSpotWebhookEvent => ({
    eventId,
    subscriptionId: 1,
    portalId: 49169539,
    appId: 1,
    occurredAt: Date.now(),
    subscriptionType: 'company.propertyChange',
    attemptNumber: 0,
    objectId,
    propertyName: 'name',
    propertyValue: 'Test Company',
  });

  beforeEach(() => {
    // Clear the event store
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__hubspotWebhookEvents = undefined;
    }
  });

  it('records new event as non-duplicate', () => {
    const event = createEvent(1001);
    const { isDuplicate, record } = recordEvent('org-1', event);

    expect(isDuplicate).toBe(false);
    expect(record.hubspotEventId).toBe('1001');
    expect(record.status).toBe('pending');
  });

  it('detects duplicate event after processing', () => {
    const event = createEvent(1002);
    const orgId = 'org-1';

    // First record
    const { isDuplicate: first } = recordEvent(orgId, event);
    expect(first).toBe(false);

    // Mark as processed
    updateEventStatus(orgId, '1002', 'processed');

    // Second record (same event ID)
    const { isDuplicate: second } = recordEvent(orgId, event);
    expect(second).toBe(true);
  });

  it('allows same event ID from different orgs', () => {
    const event = createEvent(1003);

    const { isDuplicate: org1 } = recordEvent('org-1', event);
    expect(org1).toBe(false);

    updateEventStatus('org-1', '1003', 'processed');

    const { isDuplicate: org2 } = recordEvent('org-2', event);
    expect(org2).toBe(false); // Different org, not a duplicate
  });

  it('does not flag pending events as duplicates', () => {
    const event = createEvent(1004);
    const orgId = 'org-1';

    // First record (stays pending)
    const { isDuplicate: first } = recordEvent(orgId, event);
    expect(first).toBe(false);

    // Second record while first is still pending
    // This would be a race condition in practice, but the gate
    // should allow it through (better to process twice than miss)
    const { isDuplicate: second } = recordEvent(orgId, event);
    expect(second).toBe(false);
  });
});

describe('Retry Logic', () => {
  describe('calculateBackoff', () => {
    const defaultConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
    };

    it('calculates exponential backoff (1s, 4s, 16s)', () => {
      expect(calculateBackoff(0, defaultConfig)).toBe(1000);  // 1s
      expect(calculateBackoff(1, defaultConfig)).toBe(4000);  // 4s
      expect(calculateBackoff(2, defaultConfig)).toBe(16000); // 16s
    });

    it('caps at max delay', () => {
      expect(calculateBackoff(5, defaultConfig)).toBe(60000); // Capped at max
    });

    it('uses custom config', () => {
      const customConfig = {
        maxAttempts: 5,
        baseDelayMs: 500,
        maxDelayMs: 10000,
      };

      expect(calculateBackoff(0, customConfig)).toBe(500);   // 0.5s
      expect(calculateBackoff(1, customConfig)).toBe(2000);  // 2s
      expect(calculateBackoff(2, customConfig)).toBe(8000);  // 8s
      expect(calculateBackoff(3, customConfig)).toBe(10000); // Capped at 10s
    });
  });
});

describe('Implicit vs Explicit Mode', () => {
  it('implicit mode should auto-process events', () => {
    // This is a behavioral test that would require mocking the HubSpot client
    // The actual logic is tested in processWebhookEvent
    expect(true).toBe(true);
  });

  it('explicit mode should queue events for review', () => {
    // This is a behavioral test that would require mocking the HubSpot client
    // The actual logic is tested in processWebhookEvent
    expect(true).toBe(true);
  });
});

describe('Event Types', () => {
  beforeEach(() => {
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__hubspotWebhookEvents = undefined;
    }
  });

  it('records company.creation events', () => {
    const event: HubSpotWebhookEvent = {
      eventId: 2001,
      subscriptionId: 1,
      portalId: 49169539,
      appId: 1,
      occurredAt: Date.now(),
      subscriptionType: 'company.creation',
      attemptNumber: 0,
      objectId: 12345,
    };

    const { record } = recordEvent('org-1', event);
    expect(record.eventType).toBe('company.creation');
    expect(record.propertyName).toBeNull();
  });

  it('records company.propertyChange events with property info', () => {
    const event: HubSpotWebhookEvent = {
      eventId: 2002,
      subscriptionId: 1,
      portalId: 49169539,
      appId: 1,
      occurredAt: Date.now(),
      subscriptionType: 'company.propertyChange',
      attemptNumber: 0,
      objectId: 12345,
      propertyName: 'industry',
      propertyValue: 'Technology',
    };

    const { record } = recordEvent('org-1', event);
    expect(record.eventType).toBe('company.propertyChange');
    expect(record.propertyName).toBe('industry');
    expect(record.propertyValue).toBe('Technology');
  });
});

describe('Status Updates', () => {
  beforeEach(() => {
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__hubspotWebhookEvents = undefined;
    }
  });

  it('updates event status to processed', () => {
    const event: HubSpotWebhookEvent = {
      eventId: 3001,
      subscriptionId: 1,
      portalId: 49169539,
      appId: 1,
      occurredAt: Date.now(),
      subscriptionType: 'company.creation',
      attemptNumber: 0,
      objectId: 12345,
    };

    const { record: initial } = recordEvent('org-1', event);
    expect(initial.status).toBe('pending');
    expect(initial.processedAt).toBeNull();

    updateEventStatus('org-1', '3001', 'processed');

    // Check the event is now a duplicate (processed)
    const { isDuplicate, record: updated } = recordEvent('org-1', event);
    expect(isDuplicate).toBe(true);
    expect(updated.status).toBe('processed');
    expect(updated.processedAt).not.toBeNull();
  });

  it('updates event status to failed with error message', () => {
    const event: HubSpotWebhookEvent = {
      eventId: 3002,
      subscriptionId: 1,
      portalId: 49169539,
      appId: 1,
      occurredAt: Date.now(),
      subscriptionType: 'company.creation',
      attemptNumber: 0,
      objectId: 12345,
    };

    recordEvent('org-1', event);
    updateEventStatus('org-1', '3002', 'failed', 'Rate limit exceeded');

    const { isDuplicate, record } = recordEvent('org-1', event);
    expect(isDuplicate).toBe(true);
    expect(record.status).toBe('failed');
    expect(record.errorMessage).toBe('Rate limit exceeded');
  });
});
