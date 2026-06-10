/**
 * API Tests
 *
 * Tests for import API routes
 * 8 tests covering auth, validation, beta gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockGetOrgContext = vi.fn();
const mockIsBetaFeatureEnabled = vi.fn();
const mockSupabaseAdmin = {
  from: vi.fn(),
};
const mockImportQueue = {
  add: vi.fn(),
};
const mockGetAccessToken = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: () => mockGetOrgContext(),
  authError: (e: any) => {
    if (e instanceof Response) return e;
    return null;
  },
}));

vi.mock('@/lib/auth/roles', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/features/flags', () => ({
  isBetaFeatureEnabled: (orgId: string, flag: string) => mockIsBetaFeatureEnabled(orgId, flag),
  FEATURE_FLAGS: {
    EVENT_LIST_IMPORT: 'event_list_import',
  },
}));

vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: mockSupabaseAdmin,
  createServiceClient: () => mockSupabaseAdmin,
}));

vi.mock('@/lib/queue/import-queue', () => ({
  importQueue: mockImportQueue,
}));

vi.mock('@/lib/hubspot/oauth', () => ({
  getAccessToken: (orgId: string) => mockGetAccessToken(orgId),
}));

vi.mock('@/lib/hubspot/get-access-token', () => ({
  getAccessToken: (orgId: string) => mockGetAccessToken(orgId),
}));

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((text: string, options: any) => {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map((h: string) => h.trim());
      const data = lines.slice(1).map((line: string) => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((h: string, i: number) => {
          obj[h] = values[i]?.trim() || '';
        });
        return obj;
      });
      return {
        data,
        errors: [],
        meta: { fields: headers },
      };
    }),
  },
}));

vi.mock('@/lib/hubspot/client', () => {
  return {
    HubSpotClient: class MockHubSpotClient {
      constructor(public accessToken: string, public portalId: string) {}
      async request() {
        return { results: [] };
      }
    },
  };
});

describe('POST /api/import/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgContext.mockResolvedValue({
      orgId: 'org-123',
      userId: 'user-456',
      userEmail: 'admin@example.com',
      orgRole: 'org:admin',
    });
    mockIsBetaFeatureEnabled.mockResolvedValue(true);
  });

  it('should reject non-CSV files', async () => {
    const { POST } = await import('@/app/api/import/parse/route');

    const formData = new FormData();
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/import/parse', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('.csv');
  });

  it('should reject files over 10MB', async () => {
    const { POST } = await import('@/app/api/import/parse/route');

    const formData = new FormData();
    // Create a large buffer (11MB)
    const largeContent = 'x'.repeat(11 * 1024 * 1024);
    const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/import/parse', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('large');
  });

  it('should reject files with no email column', async () => {
    const { POST } = await import('@/app/api/import/parse/route');

    const csvContent = 'name,company\nJohn Doe,Acme Corp\n';
    const formData = new FormData();
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/import/parse', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('email');
  });

  it('should parse CSV and create import session', async () => {
    // Mock supabase responses
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-123' },
      error: null,
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'event_imports') {
        return {
          insert: mockInsert,
          select: mockSelect,
          single: mockSingle,
        };
      }
      if (table === 'event_import_rows') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    const { POST } = await import('@/app/api/import/parse/route');

    const csvContent = 'email,name,company\ntest@example.com,John Doe,Acme Corp\n';
    const formData = new FormData();
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/import/parse', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.session_id).toBe('session-123');
    expect(body.columns).toBeDefined();
    expect(body.preview_rows).toBeDefined();
  });
});

describe('POST /api/import/match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgContext.mockResolvedValue({
      orgId: 'org-123',
      userId: 'user-456',
      userEmail: 'admin@example.com',
      orgRole: 'org:admin',
    });
    mockIsBetaFeatureEnabled.mockResolvedValue(true);
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  it('should require valid session_id', async () => {
    // Mock supabase to return no session
    mockSupabaseAdmin.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    }));

    const { POST } = await import('@/app/api/import/match/route');

    const request = new NextRequest('http://localhost:3000/api/import/match', {
      method: 'POST',
      body: JSON.stringify({
        session_id: 'invalid-id',
        field_mapping: { email: 'email' },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('not found');
  });

  it('should run matching and return summary', async () => {
    // Mock supabase responses
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockUpdate = vi.fn().mockReturnThis();

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'event_imports') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'session-123',
                    org_id: 'org-123',
                    status: 'parsed',
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'event_import_rows') {
        return {
          select: mockSelect,
          eq: mockEq,
          order: mockOrder,
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      return {};
    });

    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'row-1',
          raw_data: { email: 'test@example.com', name: 'John Doe' },
        },
      ],
      error: null,
    });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { POST } = await import('@/app/api/import/match/route');

    const request = new NextRequest('http://localhost:3000/api/import/match', {
      method: 'POST',
      body: JSON.stringify({
        session_id: 'session-123',
        field_mapping: { email: 'email', full_name: 'name' },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toBeDefined();
    expect(body.sample_rows).toBeDefined();
  });
});

describe('POST /api/import/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgContext.mockResolvedValue({
      orgId: 'org-123',
      userId: 'user-456',
      userEmail: 'admin@example.com',
      orgRole: 'org:admin',
    });
  });

  it('should enqueue import job', async () => {
    mockIsBetaFeatureEnabled.mockResolvedValue(true);

    // Mock supabase responses
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'event_imports') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'session-123',
                    org_id: 'org-123',
                    status: 'matched',
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'org_billing') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  subscription_tier: 'scale',
                  subscription_status: 'active',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockImportQueue.add.mockResolvedValue({ id: 'job-456' });

    const { POST } = await import('@/app/api/import/execute/route');

    const request = new NextRequest('http://localhost:3000/api/import/execute', {
      method: 'POST',
      body: JSON.stringify({
        session_id: 'session-123',
        write_config: {
          create_new_contacts: true,
          update_customers: false,
          update_known_contacts: false,
          skip_needs_review: true,
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.job_id).toBe('job-456');
    expect(body.import_id).toBe('session-123');
    expect(mockImportQueue.add).toHaveBeenCalledWith(
      'event-list-import',
      expect.any(Object),
      expect.objectContaining({ priority: expect.any(Number) })
    );
  });

  it('should enforce beta gate', async () => {
    mockIsBetaFeatureEnabled.mockResolvedValue(false);

    const { POST } = await import('@/app/api/import/execute/route');

    const request = new NextRequest('http://localhost:3000/api/import/execute', {
      method: 'POST',
      body: JSON.stringify({
        session_id: 'session-123',
        write_config: { create_new_contacts: true },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('feature_not_enabled');
  });
});
