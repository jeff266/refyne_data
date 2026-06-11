/**
 * Admin Billing Tests
 *
 * Tests admin workspace management controls with staff-only access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: vi.fn(),
  authError: vi.fn(),
}));

vi.mock('@/lib/auth/staff-helpers', () => ({
  requireRefyneStaff: vi.fn(),
}));

vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import * as clerkHelpers from '@/lib/auth/clerk-helpers';
import * as staffHelpers from '@/lib/auth/staff-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

describe('Admin Billing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth mock
    vi.mocked(clerkHelpers.getOrgContext).mockResolvedValue({
      userId: 'user_staff123',
      orgId: 'org_staff123',
      sessionId: 'sess_123',
    });

    // Default staff check passes
    vi.mocked(staffHelpers.requireRefyneStaff).mockResolvedValue(undefined);
  });

  describe('GET /api/admin/workspaces/[orgId]/billing', () => {
    it('1. returns 403 for non-staff user', async () => {
      // Mock staff check to fail
      vi.mocked(staffHelpers.requireRefyneStaff).mockRejectedValue(new Error('Not staff'));

      const { GET } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      const response = await GET(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing'),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(403);
    });

    it('2. returns billing data for staff user', async () => {
      const mockBilling = {
        org_id: 'org_test',
        subscription_tier: 'growth',
        subscription_status: 'active',
        trial_end_date: null,
        pro_monthly_enrich_credits: 500,
      };

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockBilling,
              error: null,
            }),
          }),
        }),
      } as any);

      const { GET } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      const response = await GET(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing'),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.billing).toEqual(mockBilling);
    });
  });

  describe('PATCH /api/admin/workspaces/[orgId]/billing', () => {
    const mockBilling = {
      org_id: 'org_test',
      subscription_tier: 'trial',
      subscription_status: 'trialing',
      trial_end_date: '2026-06-21T00:00:00Z',
      trial_merges_used: 10,
      trial_normalize_writes_used: 20,
      trial_enrich_credits_used: 5,
      pro_monthly_enrich_credits: 50,
    };

    beforeEach(() => {
      // Mock select query (for fetching current billing)
      const mockSelect = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockBilling,
          error: null,
        }),
      };

      // Mock update query
      const mockUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockBilling, subscription_tier: 'growth' },
          error: null,
        }),
      };

      // Mock insert query (for audit log)
      const mockInsert = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      // Mock from() to return appropriate chain based on table name
      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'admin_audit_log') return mockInsert as any;
        if (table === 'org_feature_flags') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        // For org_billing, return both select and update chains
        return {
          ...mockSelect,
          ...mockUpdate,
        } as any;
      });
    });

    it('3. changes subscription tier', async () => {
      const { PATCH } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing', {
          method: 'PATCH',
          body: JSON.stringify({
            subscription_tier: 'growth',
            note: 'Upgraded to growth plan',
          }),
        }),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.billing.subscription_tier).toBe('growth');
    });

    it('4. extends trial end date', async () => {
      const newDate = '2026-07-21T00:00:00Z';

      const { PATCH } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing', {
          method: 'PATCH',
          body: JSON.stringify({
            trial_end_date: newDate,
            note: 'Extended trial by 30 days',
          }),
        }),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(200);
    });

    it('5. resets trial usage counters', async () => {
      const { PATCH } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing', {
          method: 'PATCH',
          body: JSON.stringify({
            reset_trial_usage: true,
            note: 'Reset trial counters',
          }),
        }),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(200);
    });

    it('6. adds credits to monthly limit', async () => {
      const { PATCH } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing', {
          method: 'PATCH',
          body: JSON.stringify({
            add_enrich_credits: 100,
            note: 'Added 100 credits',
          }),
        }),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(200);
    });

    it('7. logs every change to admin_audit_log', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'admin_audit_log') {
          return { insert: mockInsert } as any;
        }
        if (table === 'org_feature_flags') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...mockBilling, subscription_tier: 'growth' },
            error: null,
          }),
        } as any;
      });

      const { PATCH } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      await PATCH(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing', {
          method: 'PATCH',
          body: JSON.stringify({
            subscription_tier: 'growth',
            note: 'Test note',
          }),
        }),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(mockInsert).toHaveBeenCalled();
      const auditEntry = mockInsert.mock.calls[0][0];
      expect(auditEntry).toMatchObject({
        admin_user_id: 'user_staff123',
        target_org_id: 'org_test',
        action: 'change_plan',
        note: 'Test note',
      });
    });

    it('8. saves note field to audit log', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'admin_audit_log') {
          return { insert: mockInsert } as any;
        }
        if (table === 'org_feature_flags') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockBilling,
            error: null,
          }),
        } as any;
      });

      const { PATCH } = await import('@/app/api/admin/workspaces/[orgId]/billing/route');
      await PATCH(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/billing', {
          method: 'PATCH',
          body: JSON.stringify({
            add_enrich_credits: 50,
            note: 'Emergency credit top-up for demo',
          }),
        }),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      const auditEntry = mockInsert.mock.calls[0][0];
      expect(auditEntry.note).toBe('Emergency credit top-up for demo');
    });
  });

  describe('GET /api/admin/workspaces/[orgId]/audit-log', () => {
    it('9. returns audit log entries newest first', async () => {
      const mockEntries = [
        {
          id: '1',
          admin_user_id: 'user_staff123',
          target_org_id: 'org_test',
          action: 'change_plan',
          note: 'Upgraded',
          created_at: '2026-06-11T10:00:00Z',
        },
        {
          id: '2',
          admin_user_id: 'user_staff123',
          target_org_id: 'org_test',
          action: 'extend_trial',
          note: 'Extended +14 days',
          created_at: '2026-06-10T10:00:00Z',
        },
      ];

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockEntries,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const { GET } = await import('@/app/api/admin/workspaces/[orgId]/audit-log/route');
      const response = await GET(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/audit-log'),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.entries).toEqual(mockEntries);
      expect(data.entries[0].created_at).toBe('2026-06-11T10:00:00Z'); // Newest first
    });

    it('10. returns 403 for non-staff user', async () => {
      vi.mocked(staffHelpers.requireRefyneStaff).mockRejectedValue(new Error('Not staff'));

      const { GET } = await import('@/app/api/admin/workspaces/[orgId]/audit-log/route');
      const response = await GET(
        new NextRequest('http://localhost/api/admin/workspaces/org_test/audit-log'),
        { params: Promise.resolve({ orgId: 'org_test' }) }
      );

      expect(response.status).toBe(403);
    });
  });
});
