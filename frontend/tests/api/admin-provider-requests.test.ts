/**
 * Admin Provider Requests API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockGetOrgContext = vi.fn();
const mockAuthError = vi.fn();
const mockCurrentUser = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: () => mockGetOrgContext(),
  authError: (e: any) => mockAuthError(e),
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: () => mockCurrentUser(),
}));

vi.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Import routes after mocking
import { GET } from '@/app/api/admin/provider-requests/route';
import { PATCH } from '@/app/api/admin/provider-requests/[id]/route';
import { supabaseAdmin } from '@/lib/db/supabase';

describe('Admin Provider Requests API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgContext.mockResolvedValue({
      orgId: 'org_test123',
      userId: 'user_test123',
    });
  });

  describe('GET /api/admin/provider-requests', () => {
    it('returns 403 for non-Refyne staff', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'user@example.com' }],
      });

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('returns all requests for Refyne staff', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'admin@refynedata.com' }],
      });

      const mockRequests = [
        {
          id: 'req_1',
          org_id: 'org_1',
          requested_by: 'user_1',
          provider_name: 'Clearbit',
          reason: 'Better data',
          status: 'pending',
          admin_notes: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'req_2',
          org_id: 'org_2',
          requested_by: 'user_2',
          provider_name: '6sense',
          reason: null,
          status: 'reviewing',
          admin_notes: 'In progress',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockRequests,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requests).toHaveLength(2);
      expect(data.requests[0].provider_name).toBe('Clearbit');
    });

    it('accepts @refyne.com email domain', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'admin@refyne.com' }],
      });

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /api/admin/provider-requests/[id]', () => {
    it('returns 403 for non-Refyne staff', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'user@example.com' }],
      });

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests/req_123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped' }),
      });

      const response = await PATCH(request, { params: { id: 'req_123' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('updates status successfully for Refyne staff', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'admin@refynedata.com' }],
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'req_123',
                status: 'shipped',
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests/req_123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped' }),
      });

      const response = await PATCH(request, { params: { id: 'req_123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.request.status).toBe('shipped');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'shipped',
        })
      );
    });

    it('validates status values', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'admin@refynedata.com' }],
      });

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests/req_123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid_status' }),
      });

      const response = await PATCH(request, { params: { id: 'req_123' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid status');
    });

    it('allows updating admin_notes', async () => {
      mockCurrentUser.mockResolvedValue({
        emailAddresses: [{ emailAddress: 'admin@refynedata.com' }],
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'req_123',
                admin_notes: 'Will ship next week',
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/provider-requests/req_123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: 'Will ship next week' }),
      });

      const response = await PATCH(request, { params: { id: 'req_123' } });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_notes: 'Will ship next week',
        })
      );
    });
  });
});
