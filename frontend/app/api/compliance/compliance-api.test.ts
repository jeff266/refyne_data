/**
 * Compliance API Routes Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock compliance module
const mockGetScore = vi.fn();
const mockGetPreviousScore = vi.fn();
const mockEnqueueScan = vi.fn();
const mockGetBreakdownByHarmony = vi.fn();
const mockGetBreakdownByField = vi.fn();
const mockGetActiveInsights = vi.fn();

vi.mock('@/lib/compliance', () => ({
  getScore: () => mockGetScore(),
  getPreviousScore: () => mockGetPreviousScore(),
  enqueueScan: (...args: unknown[]) => mockEnqueueScan(...args),
  getBreakdownByHarmony: () => mockGetBreakdownByHarmony(),
  getBreakdownByField: () => mockGetBreakdownByField(),
  getActiveInsights: () => mockGetActiveInsights(),
}));

// Import routes after mocking
import { GET as getScore } from './score/route';
import { POST as postScan } from './scan/route';
import { GET as getBreakdown } from './breakdown/route';

describe('Compliance API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/compliance/score', () => {
    it('returns correct structure with score data', async () => {
      mockGetScore.mockResolvedValue({
        score: 85.5,
        compliant: 855,
        stale: 100,
        unprocessed: 45,
        total: 1000,
        lastComputedAt: '2024-01-01T00:00:00Z',
      });

      mockGetPreviousScore.mockResolvedValue(80);

      const request = new NextRequest('http://localhost:3000/api/compliance/score?orgId=org-123');
      const response = await getScore(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.score).toBe(85.5);
      expect(data.compliant).toBe(855);
      expect(data.stale).toBe(100);
      expect(data.unprocessed).toBe(45);
      expect(data.total).toBe(1000);
      expect(data.trendDelta).toBe(5.5);
      expect(data.lastComputedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('returns 400 when orgId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/compliance/score');
      const response = await getScore(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('orgId');
    });

    it('returns null trendDelta when no previous score', async () => {
      mockGetScore.mockResolvedValue({
        score: 75,
        compliant: 75,
        stale: 15,
        unprocessed: 10,
        total: 100,
        lastComputedAt: null,
      });

      mockGetPreviousScore.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/compliance/score?orgId=org-123');
      const response = await getScore(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trendDelta).toBeNull();
    });
  });

  describe('POST /api/compliance/scan', () => {
    it('enqueues job and returns jobId', async () => {
      mockEnqueueScan.mockResolvedValue({
        queued: true,
        jobId: 'scan:org-123:1234567890',
      });

      const request = new NextRequest('http://localhost:3000/api/compliance/scan', {
        method: 'POST',
        body: JSON.stringify({
          orgId: 'org-123',
          accessToken: 'pat-xxx',
          hasExportScope: true,
        }),
      });

      const response = await postScan(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBe('scan:org-123:1234567890');
      expect(mockEnqueueScan).toHaveBeenCalledWith('org-123', 'pat-xxx', true);
    });

    it('returns 400 when orgId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/compliance/scan', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: 'pat-xxx',
        }),
      });

      const response = await postScan(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('orgId');
    });

    it('returns 400 when accessToken is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/compliance/scan', {
        method: 'POST',
        body: JSON.stringify({
          orgId: 'org-123',
        }),
      });

      const response = await postScan(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('accessToken');
    });

    it('returns 503 when queue is not available', async () => {
      mockEnqueueScan.mockResolvedValue({
        queued: false,
        reason: 'Queue not configured',
      });

      const request = new NextRequest('http://localhost:3000/api/compliance/scan', {
        method: 'POST',
        body: JSON.stringify({
          orgId: 'org-123',
          accessToken: 'pat-xxx',
        }),
      });

      const response = await postScan(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Queue not configured');
    });
  });

  describe('GET /api/compliance/breakdown', () => {
    it('returns harmony breakdown by default', async () => {
      mockGetBreakdownByHarmony.mockResolvedValue([
        { harmonyId: 'company-industry', compliant: 80, stale: 10, unprocessed: 10, rate: 80 },
        { harmonyId: 'company-name', compliant: 95, stale: 3, unprocessed: 2, rate: 95 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/compliance/breakdown?orgId=org-123');
      const response = await getBreakdown(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.by).toBe('harmony');
      expect(data.items.length).toBe(2);
      expect(data.items[0].harmonyId).toBe('company-industry');
    });

    it('returns field breakdown when by=field', async () => {
      mockGetBreakdownByField.mockResolvedValue([
        { field: 'industry', compliant: 80, stale: 10, unprocessed: 10, rate: 80 },
        { field: 'name', compliant: 95, stale: 3, unprocessed: 2, rate: 95 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/compliance/breakdown?orgId=org-123&by=field');
      const response = await getBreakdown(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.by).toBe('field');
      expect(data.items.length).toBe(2);
      expect(data.items[0].field).toBe('industry');
    });

    it('returns 400 for invalid by parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/compliance/breakdown?orgId=org-123&by=invalid');
      const response = await getBreakdown(request);

      expect(response.status).toBe(400);
    });
  });
});
