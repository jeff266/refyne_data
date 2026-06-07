/**
 * RBAC API Route Enforcement Tests
 *
 * Integration tests verifying that admin-only API routes properly enforce
 * the org:admin role requirement by returning 403 for org:member users.
 *
 * Routes tested:
 * - POST /api/normalize/apply - Apply normalization changes
 * - POST /api/dedup/clusters/[id]/merge - Merge duplicate clusters
 * - POST /api/harmonies - Create new harmony
 * - POST /api/billing/create-checkout - Create billing checkout session
 * - POST /api/jobs/classify - Classify job titles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock getOrgContext to return different roles
const mockGetOrgContext = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: () => mockGetOrgContext(),
  authError: (e: any) => {
    if (e instanceof Response) return e;
    return null;
  },
}));

// Mock other dependencies to isolate role enforcement
vi.mock('@/lib/db/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: () => true,
}));

vi.mock('@/lib/billing/check-feature', () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  parseFeatureGateError: vi.fn(),
}));

vi.mock('@/lib/monitoring/sentry', () => ({
  captureWithOrgContext: vi.fn(),
}));

vi.mock('@/lib/harmonies/seed-library', () => ({
  seedHarmonyLibrary: vi.fn(),
}));

vi.mock('@/lib/harmonies/job-title-classifier', () => ({
  classifyJobTitleBatch: vi.fn().mockResolvedValue(new Map()),
}));

describe('RBAC API Route Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/normalize/apply', () => {
    it('returns 403 when user has org:member role', async () => {
      // Mock getOrgContext to return org:member
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'member@example.com',
        orgRole: 'org:member',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/normalize/apply/route');

      const request = new NextRequest('http://localhost:3000/api/normalize/apply', {
        method: 'POST',
        body: JSON.stringify({
          harmonyIds: ['company-industry'],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('admin_required');
    });

    it('does not return 403 when user has org:admin role', async () => {
      // Mock getOrgContext to return org:admin
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'admin@example.com',
        orgRole: 'org:admin',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/normalize/apply/route');

      const request = new NextRequest('http://localhost:3000/api/normalize/apply', {
        method: 'POST',
        body: JSON.stringify({
          harmonyIds: ['company-industry'],
        }),
      });

      const response = await POST(request);

      // Should not be 403 - might be 503 or 500 due to other dependencies,
      // but the important thing is it's NOT 403 (admin check passed)
      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/dedup/clusters/[id]/merge', () => {
    it('returns 403 when user has org:member role', async () => {
      // Mock getOrgContext to return org:member
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'member@example.com',
        orgRole: 'org:member',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/dedup/clusters/[id]/merge/route');

      const request = new NextRequest('http://localhost:3000/api/dedup/clusters/cluster-1/merge', {
        method: 'POST',
        body: JSON.stringify({
          masterId: 'company-123',
        }),
      });

      const response = await POST(request, { params: { id: 'cluster-1' } });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('admin_required');
    });

    it('does not return 403 when user has org:admin role', async () => {
      // Mock getOrgContext to return org:admin
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'admin@example.com',
        orgRole: 'org:admin',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/dedup/clusters/[id]/merge/route');

      const request = new NextRequest('http://localhost:3000/api/dedup/clusters/cluster-1/merge', {
        method: 'POST',
        body: JSON.stringify({
          masterId: 'company-123',
        }),
      });

      const response = await POST(request, { params: { id: 'cluster-1' } });

      // Should not be 403 (admin check passed)
      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/harmonies', () => {
    it('returns 403 when user has org:member role', async () => {
      // Mock getOrgContext to return org:member
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'member@example.com',
        orgRole: 'org:member',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/harmonies/route');

      const request = new NextRequest('http://localhost:3000/api/harmonies', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Harmony',
          field: 'industry',
          object_type: 'company',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('Insufficient permissions');
    });

    it('does not return 403 when user has org:admin role', async () => {
      // Mock getOrgContext to return org:admin
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'admin@example.com',
        orgRole: 'org:admin',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/harmonies/route');

      const request = new NextRequest('http://localhost:3000/api/harmonies', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Harmony',
          field: 'industry',
          object_type: 'company',
        }),
      });

      const response = await POST(request);

      // Should not be 403 (admin check passed)
      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/billing/create-checkout', () => {
    it('returns 403 when user has org:member role', async () => {
      // Mock getOrgContext to return org:member
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'member@example.com',
        orgRole: 'org:member',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/billing/create-checkout/route');

      const request = new NextRequest('http://localhost:3000/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          tier: 'pro',
          billing_period: 'monthly',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('admin_required');
    });

    it('does not return 403 when user has org:admin role', async () => {
      // Mock getOrgContext to return org:admin
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'admin@example.com',
        orgRole: 'org:admin',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/billing/create-checkout/route');

      const request = new NextRequest('http://localhost:3000/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          tier: 'pro',
          billing_period: 'monthly',
        }),
      });

      const response = await POST(request);

      // Should not be 403 (admin check passed)
      expect(response.status).not.toBe(403);
    });
  });

  describe('POST /api/jobs/classify', () => {
    it('returns 403 when user has org:member role', async () => {
      // Mock getOrgContext to return org:member
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'member@example.com',
        orgRole: 'org:member',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/jobs/classify/route');

      const request = new NextRequest('http://localhost:3000/api/jobs/classify', {
        method: 'POST',
        body: JSON.stringify({
          titles: ['CEO', 'BCBA', 'Clinical Director'],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('admin_required');
    });

    it('does not return 403 when user has org:admin role', async () => {
      // Mock getOrgContext to return org:admin
      mockGetOrgContext.mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-456',
        userEmail: 'admin@example.com',
        orgRole: 'org:admin',
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/jobs/classify/route');

      const request = new NextRequest('http://localhost:3000/api/jobs/classify', {
        method: 'POST',
        body: JSON.stringify({
          titles: ['CEO', 'BCBA', 'Clinical Director'],
        }),
      });

      const response = await POST(request);

      // Should not be 403 (admin check passed)
      expect(response.status).not.toBe(403);
    });
  });
});
