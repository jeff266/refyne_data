/**
 * Provider Requests API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockGetOrgContext = vi.fn();
const mockAuthError = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: () => mockGetOrgContext(),
  authError: (e: any) => mockAuthError(e),
}));

vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  isSupabaseConfigured: () => true,
}));

vi.mock('@/lib/monitoring/sentry', () => ({
  captureWithOrgContext: vi.fn(),
}));

// Import route after mocking
import { POST } from '@/app/api/provider-requests/route';
import { supabase } from '@/lib/db/supabase';

describe('POST /api/provider-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgContext.mockResolvedValue({
      orgId: 'org_test123',
      userId: 'user_test123',
    });
  });

  it('creates a provider request successfully', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'req_123',
            org_id: 'org_test123',
            requested_by: 'user_test123',
            provider_name: 'Clearbit',
            reason: 'Better data quality',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/provider-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_name: 'Clearbit',
        reason: 'Better data quality',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.request).toBeDefined();
    expect(data.request.provider_name).toBe('Clearbit');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org_test123',
        requested_by: 'user_test123',
        provider_name: 'Clearbit',
        reason: 'Better data quality',
        status: 'pending',
      })
    );
  });

  it('requires authentication', async () => {
    mockGetOrgContext.mockRejectedValue(new Error('Unauthorized'));
    mockAuthError.mockReturnValue({
      json: () => Promise.resolve({ error: 'Unauthorized' }),
      status: 401,
    });

    const request = new NextRequest('http://localhost:3000/api/provider-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_name: 'Test' }),
    });

    const response = await POST(request);

    expect(mockAuthError).toHaveBeenCalled();
  });

  it('validates provider_name is required', async () => {
    const request = new NextRequest('http://localhost:3000/api/provider-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Some reason' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('provider_name is required');
  });

  it('validates provider_name is not empty string', async () => {
    const request = new NextRequest('http://localhost:3000/api/provider-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_name: '   ' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('provider_name is required');
  });

  it('allows reason to be optional', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'req_123',
            org_id: 'org_test123',
            requested_by: 'user_test123',
            provider_name: 'Clearbit',
            reason: null,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/provider-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_name: 'Clearbit' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_name: 'Clearbit',
        reason: null,
      })
    );
  });

  it('trims provider_name and reason', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'req_123',
            org_id: 'org_test123',
            requested_by: 'user_test123',
            provider_name: 'Clearbit',
            reason: 'Better data',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/provider-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_name: '  Clearbit  ',
        reason: '  Better data  ',
      }),
    });

    await POST(request);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_name: 'Clearbit',
        reason: 'Better data',
      })
    );
  });
});
