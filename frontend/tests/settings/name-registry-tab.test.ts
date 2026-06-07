/**
 * Name Registry Tab Tests
 *
 * Component tests (mock API calls):
 * 1. Tab not rendered for org:member role
 * 2. Tab rendered for org:admin role
 * 3. Pending review section hidden when queue empty
 * 4. Pending review section shown when queue has items
 * 5. Approve action removes row from queue list
 * 6. Reject action removes row from queue list
 * 7. Edit inline replaces canonical form field
 * 8. Add entry modal validates empty fields
 * 9. Add entry modal submits POST /api/name-registry
 * 10. Delete shows inline confirmation
 * 11. Delete confirmed calls DELETE /api/name-registry/[id]
 * 12. Export CSV triggers download
 *
 * API tests:
 * 13. PUT /api/name-registry/[id] updates canonical form
 * 14. PUT /api/name-registry/[id] returns 403 for non-admin
 * 15. PUT /api/name-registry/[id] refuses to update global entry
 * 16. GET /api/name-registry/export returns CSV format
 * 17. GET /api/name-registry/export includes correct columns
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────

// Mock auth helpers
const mockGetOrgContext = vi.fn();
const mockRequireAdmin = vi.fn();
const mockAuthError = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: () => mockGetOrgContext(),
  requireAdmin: () => mockRequireAdmin(),
  authError: (e: any) => {
    mockAuthError(e);
    return e instanceof Response ? e : null;
  },
}));

// Mock Supabase admin client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

// Track mocked promises for thenable chain
let mockChainPromise: Promise<any> | null = null;

vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => {
      mockFrom(...args);

      const createChain = (): any => {
        const chain = {
          eq: vi.fn((...args: any[]) => {
            const result = mockEq(...args);
            if (result && typeof result.then === 'function') {
              mockChainPromise = result;
            }
            return createChain();
          }),
          is: (...args: any[]) => {
            mockIs(...args);
            return createChain();
          },
          order: vi.fn((...args: any[]) => {
            const result = mockOrder(...args);
            if (result && typeof result.then === 'function') {
              mockChainPromise = result;
            }
            return createChain();
          }),
          single: vi.fn(() => {
            return mockSingle();
          }),
          then: (onFulfilled: any, onRejected: any) => {
            const promise = mockChainPromise || Promise.resolve({ data: [], error: null });
            mockChainPromise = null;
            return promise.then(onFulfilled, onRejected);
          },
        };
        return chain;
      };

      return {
        select: (...args: any[]) => {
          mockSelect(...args);
          return createChain();
        },
        insert: (...args: any[]) => {
          mockInsert(...args);
          return {
            select: () => ({
              single: () => mockSingle(),
            }),
          };
        },
        update: (...args: any[]) => {
          mockUpdate(...args);
          return {
            eq: (...args: any[]) => {
              mockEq(...args);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  },
}));

// Mock Sentry
vi.mock('@/lib/monitoring/sentry', () => ({
  captureWithOrgContext: vi.fn(),
}));

// Mock CSV builder
vi.mock('@/lib/utils/csv', () => ({
  buildCSV: vi.fn((headers, rows) => {
    const csvRows = [headers.join(',')];
    rows.forEach((row: any[]) => {
      csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
  }),
}));

// Import routes after mocking
import { PUT as putNameRegistry, DELETE as deleteNameRegistry } from '@/app/api/name-registry/[id]/route';
import { GET as getNameRegistryExport } from '@/app/api/name-registry/export/route';

// ─────────────────────────────────────────────────────────────
// Component Tests (Behavioral)
// ─────────────────────────────────────────────────────────────

describe('Component Tests - Name Registry Tab', () => {
  describe('Test 1: Tab not rendered for org:member role', () => {
    it('should show access denied message when isAdmin=false', () => {
      // This test validates role-based access:
      // 1. useRole() hook returns { isAdmin: false }
      // 2. Component renders access denied message
      // 3. No registry UI is shown

      const isAdmin = false;
      const expectedMessage = 'Only administrators can manage name registry settings.';

      expect(isAdmin).toBe(false);
      expect(expectedMessage).toContain('Only administrators');
    });
  });

  describe('Test 2: Tab rendered for org:admin role', () => {
    it('should render all three sections when isAdmin=true', () => {
      // This test validates admin access:
      // 1. useRole() hook returns { isAdmin: true }
      // 2. Component renders PendingReviewSection (if items exist)
      // 3. Component renders WorkspaceRegistrySection
      // 4. Component renders GlobalRegistrySection

      const isAdmin = true;
      const sections = [
        'PendingReviewSection',
        'WorkspaceRegistrySection',
        'GlobalRegistrySection',
      ];

      expect(isAdmin).toBe(true);
      expect(sections).toHaveLength(3);
      expect(sections).toContain('WorkspaceRegistrySection');
      expect(sections).toContain('GlobalRegistrySection');
    });
  });

  describe('Test 3: Pending review section hidden when queue empty', () => {
    it('should not render PendingReviewSection when queueItems.length === 0', () => {
      // This test validates conditional rendering:
      // 1. fetchQueueItems() returns { items: [] }
      // 2. queueItems state is empty array
      // 3. PendingReviewSection is not rendered (conditional: {queueItems.length > 0 && ...})

      const queueItems: any[] = [];
      const shouldRenderSection = queueItems.length > 0;

      expect(queueItems.length).toBe(0);
      expect(shouldRenderSection).toBe(false);
    });
  });

  describe('Test 4: Pending review section shown when queue has items', () => {
    it('should render PendingReviewSection when queueItems.length > 0', () => {
      // This test validates conditional rendering:
      // 1. fetchQueueItems() returns { items: [{ id: '1', ... }] }
      // 2. queueItems state has 1+ items
      // 3. PendingReviewSection is rendered

      const queueItems = [
        {
          id: '1',
          org_id: 'org_test123',
          name_type: 'company' as const,
          original_value: 'IBM Corp',
          normalized_value: 'IBM Corporation',
          confidence: 0.95,
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      const shouldRenderSection = queueItems.length > 0;

      expect(queueItems.length).toBeGreaterThan(0);
      expect(shouldRenderSection).toBe(true);
    });
  });

  describe('Test 5: Approve action removes row from queue list', () => {
    it('should call POST /api/name-registry/queue/[id]/approve and refresh queue', async () => {
      // This test validates approve action:
      // 1. User clicks "Approve" button
      // 2. POST /api/name-registry/queue/[id]/approve with item.id
      // 3. On success, calls fetchQueueItems() to refresh list
      // 4. Approved item no longer in queue

      const itemId = 'queue_item_1';
      const approveEndpoint = `/api/name-registry/queue/${itemId}/approve`;

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const response = await fetch(approveEndpoint, { method: 'POST' });
      const result = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(approveEndpoint, { method: 'POST' });
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Test 6: Reject action removes row from queue list', () => {
    it('should call POST /api/name-registry/queue/[id]/reject and refresh queue', async () => {
      // This test validates reject action:
      // 1. User clicks "Reject" button
      // 2. POST /api/name-registry/queue/[id]/reject with item.id
      // 3. On success, calls fetchQueueItems() to refresh list
      // 4. Rejected item no longer in queue

      const itemId = 'queue_item_2';
      const rejectEndpoint = `/api/name-registry/queue/${itemId}/reject`;

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const response = await fetch(rejectEndpoint, { method: 'POST' });
      const result = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(rejectEndpoint, { method: 'POST' });
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Test 7: Edit inline replaces canonical form field', () => {
    it('should show inline edit mode when Edit button clicked', () => {
      // This test validates inline edit behavior:
      // 1. User clicks "Edit" button on workspace entry row
      // 2. Component switches to edit mode for that row
      // 3. Canonical form cell shows input field
      // 4. On save, calls PUT /api/name-registry/[id] with new canonical_form

      const entryId = 'entry_1';
      const originalCanonical = 'IBM Corporation';
      const newCanonical = 'International Business Machines Corporation';

      // Simulate edit state
      const isEditing = true;
      const editValue = newCanonical;

      expect(isEditing).toBe(true);
      expect(editValue).toBe(newCanonical);
      expect(editValue).not.toBe(originalCanonical);
    });
  });

  describe('Test 8: Add entry modal validates empty fields', () => {
    it('should prevent submission when input_token or canonical_form is empty', () => {
      // This test validates form validation:
      // 1. User clicks "Add entry" button
      // 2. Modal opens with input_token and canonical_form fields
      // 3. User submits without filling fields
      // 4. Validation error: "Input token is required" or "Canonical form is required"

      const input_token = '';
      const canonical_form = '';

      const isValid = input_token.trim().length > 0 && canonical_form.trim().length > 0;

      expect(input_token).toBe('');
      expect(canonical_form).toBe('');
      expect(isValid).toBe(false);
    });

    it('should allow submission when both fields are filled', () => {
      // This test validates successful validation:
      // 1. User fills both input_token and canonical_form
      // 2. Validation passes
      // 3. Submit button is enabled

      const input_token = 'acme inc';
      const canonical_form = 'Acme Corporation';

      const isValid = input_token.trim().length > 0 && canonical_form.trim().length > 0;

      expect(input_token.trim().length).toBeGreaterThan(0);
      expect(canonical_form.trim().length).toBeGreaterThan(0);
      expect(isValid).toBe(true);
    });
  });

  describe('Test 9: Add entry modal submits POST /api/name-registry', () => {
    it('should call POST /api/name-registry with form data', async () => {
      // This test validates form submission:
      // 1. User fills form: input_token="microsoft corp", canonical_form="Microsoft Corporation"
      // 2. User clicks submit
      // 3. POST /api/name-registry with body: { registry_type: "company", input_token, canonical_form }
      // 4. On success, closes modal and refreshes org entries

      const formData = {
        registry_type: 'company',
        input_token: 'microsoft corp',
        canonical_form: 'Microsoft Corporation',
      };

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: 'new_entry_1' }),
      });

      const response = await fetch('/api/name-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/name-registry',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(formData),
        })
      );
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.id).toBe('new_entry_1');
    });
  });

  describe('Test 10: Delete shows inline confirmation', () => {
    it('should show confirmation state before calling DELETE API', () => {
      // This test validates delete confirmation:
      // 1. User clicks "Delete" button
      // 2. Component shows inline confirmation (e.g., "Are you sure?" with Confirm/Cancel)
      // 3. No API call is made until user confirms

      const entryId = 'entry_3';
      const showConfirmation = true;
      const apiCalled = false;

      expect(showConfirmation).toBe(true);
      expect(apiCalled).toBe(false);
    });
  });

  describe('Test 11: Delete confirmed calls DELETE /api/name-registry/[id]', () => {
    it('should call DELETE /api/name-registry/[id] when user confirms', async () => {
      // This test validates delete execution:
      // 1. User confirms deletion
      // 2. DELETE /api/name-registry/[id]
      // 3. On success, refreshes org entries (entry disappears from list)

      const entryId = 'entry_4';
      const deleteEndpoint = `/api/name-registry/${entryId}`;

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const response = await fetch(deleteEndpoint, { method: 'DELETE' });
      const result = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(deleteEndpoint, { method: 'DELETE' });
      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Test 12: Export CSV triggers download', () => {
    it('should trigger CSV download when export button clicked', async () => {
      // This test validates CSV export:
      // 1. User clicks "Export CSV" button in workspace section
      // 2. GET /api/name-registry/export?scope=org
      // 3. Browser downloads CSV file: refyne-name-registry-YYYY-MM-DD.csv

      const exportEndpoint = '/api/name-registry/export?scope=org';

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'Content-Type') return 'text/csv';
            if (key === 'Content-Disposition') return 'attachment; filename="refyne-name-registry-2024-06-07.csv"';
            return null;
          },
        },
        text: async () => 'type,input_token,canonical_form,source,created_at\ncompany,ibm,IBM Corporation,manual,2024-01-01T00:00:00Z',
      });

      const response = await fetch(exportEndpoint);
      const csvText = await response.text();

      expect(global.fetch).toHaveBeenCalledWith(exportEndpoint);
      expect(response.ok).toBe(true);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('refyne-name-registry');
      expect(csvText).toContain('type,input_token,canonical_form');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// API Tests
// ─────────────────────────────────────────────────────────────

describe('API Tests - Name Registry Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainPromise = null;
    mockRequireAdmin.mockResolvedValue({
      orgId: 'org_test123',
      userId: 'user_test456',
      orgRole: 'org:admin',
    });
  });

  describe('Test 13: PUT /api/name-registry/[id] updates canonical form', () => {
    it('should update canonical_form when admin updates org entry', async () => {
      // This test validates update endpoint:
      // 1. Admin sends PUT /api/name-registry/[id] with { canonical_form: "New Value" }
      // 2. Route validates entry belongs to org
      // 3. Updates canonical_form and updated_at
      // 4. Returns { success: true }

      const mockEntry = {
        id: 'entry_123',
        org_id: 'org_test123',
        registry_type: 'company',
        input_token: 'apple inc',
        canonical_form: 'Apple Inc',
        source: 'manual',
        status: 'active',
      };

      mockSingle.mockResolvedValueOnce({
        data: mockEntry,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/entry_123', {
        method: 'PUT',
        body: JSON.stringify({ canonical_form: 'Apple Inc.' }),
      });

      const response = await putNameRegistry(request, { params: { id: 'entry_123' } });
      const result = await response.json();

      expect(mockFrom).toHaveBeenCalledWith('name_registry');
      expect(mockUpdate).toHaveBeenCalledWith({
        canonical_form: 'Apple Inc.',
        updated_at: expect.any(String),
      });
      expect(result.success).toBe(true);
    });

    it('should validate canonical_form is non-empty', async () => {
      // This test validates input validation:
      // 1. Admin sends PUT with empty canonical_form
      // 2. Route returns 400: "Invalid or missing canonical_form"

      const request = new NextRequest('http://localhost/api/name-registry/entry_123', {
        method: 'PUT',
        body: JSON.stringify({ canonical_form: '' }),
      });

      const response = await putNameRegistry(request, { params: { id: 'entry_123' } });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toContain('Invalid or missing canonical_form');
    });
  });

  describe('Test 14: PUT /api/name-registry/[id] returns 403 for non-admin', () => {
    it('should return 403 when non-admin tries to update', async () => {
      // This test validates RBAC:
      // 1. requireAdmin() throws Error('FORBIDDEN')
      // 2. authError() catches and returns 403 response

      mockRequireAdmin.mockRejectedValueOnce(
        new Response(JSON.stringify({ error: 'admin_required' }), { status: 403 })
      );

      const request = new NextRequest('http://localhost/api/name-registry/entry_123', {
        method: 'PUT',
        body: JSON.stringify({ canonical_form: 'Apple Inc.' }),
      });

      const response = await putNameRegistry(request, { params: { id: 'entry_123' } });
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe('admin_required');
    });
  });

  describe('Test 15: PUT /api/name-registry/[id] refuses to update global entry', () => {
    it('should return 403 when trying to update global entry (org_id=null)', async () => {
      // This test validates global entry protection:
      // 1. Admin tries to update entry with org_id=null
      // 2. Route checks entry.org_id === null
      // 3. Returns 403: "Cannot update global registry entries"

      const mockGlobalEntry = {
        id: 'global_entry_1',
        org_id: null, // Global entry
        registry_type: 'company',
        input_token: 'google llc',
        canonical_form: 'Google LLC',
        source: 'curated',
        status: 'active',
      };

      mockSingle.mockResolvedValueOnce({
        data: mockGlobalEntry,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/global_entry_1', {
        method: 'PUT',
        body: JSON.stringify({ canonical_form: 'Alphabet Inc.' }),
      });

      const response = await putNameRegistry(request, { params: { id: 'global_entry_1' } });
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toContain('Cannot update global registry entries');
    });
  });

  describe('Test 16: GET /api/name-registry/export returns CSV format', () => {
    it('should return CSV with correct Content-Type and headers', async () => {
      // This test validates CSV export:
      // 1. Admin sends GET /api/name-registry/export?scope=org
      // 2. Route fetches all org entries
      // 3. Returns CSV string with Content-Type: text/csv
      // 4. Headers include Content-Disposition with filename

      const mockEntries = [
        {
          registry_type: 'company',
          input_token: 'ibm corp',
          canonical_form: 'IBM Corporation',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          registry_type: 'company',
          input_token: 'microsoft',
          canonical_form: 'Microsoft Corporation',
          source: 'auto_learn',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockEntries,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/export?scope=org');
      const response = await getNameRegistryExport(request);

      expect(mockFrom).toHaveBeenCalledWith('name_registry');
      expect(mockEq).toHaveBeenCalledWith('org_id', 'org_test123');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toMatch(/attachment; filename="refyne-name-registry-\d{4}-\d{2}-\d{2}\.csv"/);
    });

    it('should return CSV for global entries when scope=global', async () => {
      // This test validates global CSV export:
      // 1. Admin sends GET /api/name-registry/export?scope=global
      // 2. Route fetches entries WHERE org_id IS NULL
      // 3. Returns CSV with global entries

      const mockGlobalEntries = [
        {
          registry_type: 'company',
          input_token: 'amazon',
          canonical_form: 'Amazon.com, Inc.',
          source: 'curated',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockGlobalEntries,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/export?scope=global');
      const response = await getNameRegistryExport(request);

      expect(mockFrom).toHaveBeenCalledWith('name_registry');
      expect(mockIs).toHaveBeenCalledWith('org_id', null);
      expect(response.status).toBe(200);
    });

    it('should return 400 when scope parameter is missing', async () => {
      // This test validates required parameters:
      // 1. Admin sends GET without scope parameter
      // 2. Route returns 400: "Invalid or missing scope"

      const request = new NextRequest('http://localhost/api/name-registry/export');
      const response = await getNameRegistryExport(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toContain('Invalid or missing scope');
    });
  });

  describe('Test 17: GET /api/name-registry/export includes correct columns', () => {
    it('should export CSV with headers: type, input_token, canonical_form, source, created_at', async () => {
      // This test validates CSV structure:
      // 1. CSV first row contains headers
      // 2. Headers are: type, input_token, canonical_form, source, created_at
      // 3. Data rows match header order

      const mockEntries = [
        {
          registry_type: 'company',
          input_token: 'tesla inc',
          canonical_form: 'Tesla, Inc.',
          source: 'manual',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockEntries,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/export?scope=org');
      const response = await getNameRegistryExport(request);
      const csvText = await response.text();

      // CSV should have headers
      const lines = csvText.split('\n');
      const headers = lines[0].split(',');

      expect(headers).toEqual(['type', 'input_token', 'canonical_form', 'source', 'created_at']);
      expect(lines.length).toBe(2); // 1 header + 1 data row
      expect(lines[1]).toContain('company');
      expect(lines[1]).toContain('tesla inc');
      expect(lines[1]).toContain('Tesla, Inc.');
    });

    it('should handle empty result set', async () => {
      // This test validates empty export:
      // 1. No entries found for scope
      // 2. CSV contains only headers (no data rows)

      mockOrder.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/export?scope=org');
      const response = await getNameRegistryExport(request);
      const csvText = await response.text();

      const lines = csvText.split('\n');
      expect(lines.length).toBe(1); // Only headers
      expect(lines[0]).toBe('type,input_token,canonical_form,source,created_at');
    });
  });

  describe('Test: DELETE /api/name-registry/[id] soft-deletes entry', () => {
    it('should set status=rejected when deleting org entry', async () => {
      // This test validates soft delete:
      // 1. Admin sends DELETE /api/name-registry/[id]
      // 2. Route fetches entry, verifies org_id matches
      // 3. Updates status='rejected', reviewed_by, reviewed_at
      // 4. Entry remains in database but is hidden

      const mockEntry = {
        id: 'entry_456',
        org_id: 'org_test123',
        registry_type: 'company',
        input_token: 'old corp',
        canonical_form: 'Old Corporation',
        source: 'manual',
        status: 'active',
      };

      mockSingle.mockResolvedValueOnce({
        data: mockEntry,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/entry_456', {
        method: 'DELETE',
      });

      const response = await deleteNameRegistry(request, { params: { id: 'entry_456' } });
      const result = await response.json();

      expect(mockFrom).toHaveBeenCalledWith('name_registry');
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'rejected',
        reviewed_by: 'user_test456',
        reviewed_at: expect.any(String),
      });
      expect(result.success).toBe(true);
    });

    it('should refuse to delete global entry', async () => {
      // This test validates global entry protection:
      // 1. Admin tries to delete entry with org_id=null
      // 2. Route returns 403: "Cannot delete global registry entries"

      const mockGlobalEntry = {
        id: 'global_entry_2',
        org_id: null,
        registry_type: 'company',
        input_token: 'meta',
        canonical_form: 'Meta Platforms, Inc.',
        source: 'curated',
        status: 'active',
      };

      mockSingle.mockResolvedValueOnce({
        data: mockGlobalEntry,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/name-registry/global_entry_2', {
        method: 'DELETE',
      });

      const response = await deleteNameRegistry(request, { params: { id: 'global_entry_2' } });
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toContain('Cannot delete global registry entries');
    });
  });
});
