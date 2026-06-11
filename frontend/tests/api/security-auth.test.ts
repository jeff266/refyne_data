/**
 * Security Tests - Authentication & Authorization
 *
 * Tests for Phase 1 security fixes:
 * - HubSpot write endpoint requires auth + portal ownership
 * - Normalize run endpoints require auth + run ownership
 * - Harmonies preview requires auth
 * - Profile workspace activate requires validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
  getAuth: vi.fn(),
}));

// Mock Supabase admin client
vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock crypto token encryption
vi.mock('@/lib/crypto/token-encryption', () => ({
  decryptToken: vi.fn((token) => `decrypted_${token}`),
}));

import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/db/admin-client';

const mockAuth = auth as any;
const mockClerkClient = clerkClient as any;
const mockSupabaseAdmin = supabaseAdmin as any;

describe('Security: HubSpot Write Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });

    const { POST } = await import('@/app/api/hubspot/write/route');
    const request = new NextRequest('http://localhost/api/hubspot/write', {
      method: 'POST',
      body: JSON.stringify({
        records: [{ _id: '123' }],
        portalId: '12345',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 403 when portal_id does not belong to org', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: 'org_abc' });

    // Mock Clerk client for getOrgContext
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: 'user_123',
          emailAddresses: [{ emailAddress: 'user@example.com' }],
        }),
      },
    });

    // Mock supabase to return no connection (portal doesn't belong to org)
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }, // Not found
    });
    const mockEq3 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockSupabaseAdmin.from.mockReturnValue({
      select: mockSelect,
    });

    const { POST } = await import('@/app/api/hubspot/write/route');
    const request = new NextRequest('http://localhost/api/hubspot/write', {
      method: 'POST',
      body: JSON.stringify({
        records: [{ _id: '123' }],
        portalId: '12345',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});

describe('Security: Normalize Run Export Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });

    const { GET } = await import('@/app/api/normalize/runs/[runId]/export/route');
    const request = new NextRequest('http://localhost/api/normalize/runs/run123/export');

    const response = await GET(request, { params: { runId: 'run123' } });
    expect(response.status).toBe(401);
  });

  it('should return 404 when run does not belong to org', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: 'org_abc' });

    // Mock supabase to return run belonging to different org
    const mockSingle = vi.fn().mockResolvedValue({
      data: { org_id: 'org_different' },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabaseAdmin.from.mockReturnValue({
      select: mockSelect,
    });

    const { GET } = await import('@/app/api/normalize/runs/[runId]/export/route');
    const request = new NextRequest('http://localhost/api/normalize/runs/run123/export');

    const response = await GET(request, { params: { runId: 'run123' } });
    expect(response.status).toBe(404); // Not 403, to avoid confirming run existence
  });
});

describe('Security: Normalize Run Details Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });

    const { GET } = await import('@/app/api/normalize/runs/[runId]/details/route');
    const request = new NextRequest('http://localhost/api/normalize/runs/run123/details');

    const response = await GET(request, { params: { runId: 'run123' } });
    expect(response.status).toBe(401);
  });

  it('should return 404 when run does not belong to org', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: 'org_abc' });

    // Mock supabase to return run belonging to different org
    const mockSingle = vi.fn().mockResolvedValue({
      data: { org_id: 'org_different' },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabaseAdmin.from.mockReturnValue({
      select: mockSelect,
    });

    const { GET } = await import('@/app/api/normalize/runs/[runId]/details/route');
    const request = new NextRequest('http://localhost/api/normalize/runs/run123/details');

    const response = await GET(request, { params: { runId: 'run123' } });
    expect(response.status).toBe(404);
  });
});

describe('Security: Normalize Run Changes Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });

    const { GET } = await import('@/app/api/normalize/runs/[runId]/changes/route');
    const request = new NextRequest('http://localhost/api/normalize/runs/run123/changes');

    const response = await GET(request, { params: { runId: 'run123' } });
    expect(response.status).toBe(401);
  });

  it('should return 404 when run does not belong to org', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: 'org_abc' });

    // Mock supabase to return run belonging to different org
    const mockSingle = vi.fn().mockResolvedValue({
      data: { org_id: 'org_different' },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabaseAdmin.from.mockReturnValue({
      select: mockSelect,
    });

    const { GET } = await import('@/app/api/normalize/runs/[runId]/changes/route');
    const request = new NextRequest('http://localhost/api/normalize/runs/run123/changes');

    const response = await GET(request, { params: { runId: 'run123' } });
    expect(response.status).toBe(404);
  });
});

describe('Security: Harmonies Preview Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });

    const { POST } = await import('@/app/api/harmonies/preview/route');
    const request = new NextRequest('http://localhost/api/harmonies/preview', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});

describe('Security: Profile Workspace Activate Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const { PUT } = await import('@/app/api/profile/workspace/activate/route');
    const request = new NextRequest('http://localhost/api/profile/workspace/activate', {
      method: 'PUT',
      body: JSON.stringify({ orgId: 'org_123' }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 when orgId is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const { PUT } = await import('@/app/api/profile/workspace/activate/route');
    const request = new NextRequest('http://localhost/api/profile/workspace/activate', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 when orgId is invalid format', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    const { PUT } = await import('@/app/api/profile/workspace/activate/route');
    const request = new NextRequest('http://localhost/api/profile/workspace/activate', {
      method: 'PUT',
      body: JSON.stringify({ orgId: 'invalid_format' }), // Doesn't start with 'org_'
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('should return 403 when user is not a member of the organization', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });

    // Mock Clerk to return empty membership list (user not a member)
    mockClerkClient.mockResolvedValue({
      organizations: {
        getOrganizationMembershipList: vi.fn().mockResolvedValue({
          data: [], // No memberships found for this user in this org
          totalCount: 0,
        }),
      },
    });

    const { PUT } = await import('@/app/api/profile/workspace/activate/route');
    const request = new NextRequest('http://localhost/api/profile/workspace/activate', {
      method: 'PUT',
      body: JSON.stringify({ orgId: 'org_not_member' }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(403);
  });
});
