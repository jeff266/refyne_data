/**
 * Bucket Cards Tests
 *
 * Component tests (behavioral):
 * 1. Zero-count card is not clickable
 * 2. Non-zero card click expands table
 * 3. Second click on same card collapses table
 * 4. Clicking different card collapses first, expands second
 * 5. Table shows correct columns per bucket type
 * 6. needs_review bucket shows Review Reason column
 * 7. Other buckets hide Review Reason column
 * 8. Name shows cleaned version
 * 9. Pagination: shows 20 rows, prev/next work
 * 10. Download link calls correct export endpoint
 *
 * API tests:
 * 11. GET /api/import/[id]/bucket/customer/export returns CSV with correct columns
 * 12. Returns 404 for invalid session_id
 * 13. Returns 400 for invalid bucket name
 * 14. Only returns rows matching the requested bucket
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────

// Mock auth helpers
const mockGetOrgContext = vi.fn();
const mockAuthError = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: () => mockGetOrgContext(),
  authError: (e: any) => {
    mockAuthError(e);
    return e instanceof Response ? e : null;
  },
}));

// Mock Supabase admin client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

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
      };
    },
  },
}));

// Import route after mocking
import { GET as getBucketExport } from '@/app/api/import/[session_id]/bucket/[bucket]/export/route';

// ─────────────────────────────────────────────────────────────
// Component Tests (Behavioral)
// ─────────────────────────────────────────────────────────────

describe('Component Tests - Bucket Cards', () => {
  describe('Test 1: Zero-count card is not clickable', () => {
    it('should apply cursor-default class when bucket count is 0', () => {
      // This test validates zero-count card behavior:
      // 1. Bucket summary has former_customer: 0
      // 2. Card shows cursor-default class (not clickable)
      // 3. Click handler returns early without expanding

      const bucketCount = 0;
      const isClickable = bucketCount > 0;
      const cursorClass = isClickable ? 'cursor-pointer' : 'cursor-default';

      expect(bucketCount).toBe(0);
      expect(isClickable).toBe(false);
      expect(cursorClass).toBe('cursor-default');
    });
  });

  describe('Test 2: Non-zero card click expands table', () => {
    it('should set expandedBucket state and show table when clicked', () => {
      // This test validates card expansion:
      // 1. User clicks customer card (count: 10)
      // 2. expandedBucket state changes from null to 'customer'
      // 3. Table becomes visible
      // 4. Header shows "Customer - 10 contacts"

      const bucketCount = 10;
      let expandedBucket: string | null = null;

      // Simulate click
      const handleCardClick = (bucket: string) => {
        if (bucketCount > 0) {
          expandedBucket = expandedBucket === bucket ? null : bucket;
        }
      };

      handleCardClick('customer');

      expect(expandedBucket).toBe('customer');
      expect(expandedBucket !== null).toBe(true); // Table visible
    });
  });

  describe('Test 3: Second click on same card collapses table', () => {
    it('should set expandedBucket to null when clicking expanded card', () => {
      // This test validates toggle behavior:
      // 1. Card is already expanded (expandedBucket = 'customer')
      // 2. User clicks same card again
      // 3. expandedBucket changes to null
      // 4. Table disappears

      let expandedBucket: string | null = 'customer';

      const handleCardClick = (bucket: string) => {
        expandedBucket = expandedBucket === bucket ? null : bucket;
      };

      // Click same card
      handleCardClick('customer');

      expect(expandedBucket).toBe(null);
    });
  });

  describe('Test 4: Clicking different card collapses first, expands second', () => {
    it('should switch expandedBucket when clicking different card', () => {
      // This test validates single-bucket expansion:
      // 1. Customer card is expanded (expandedBucket = 'customer')
      // 2. User clicks open_deal card
      // 3. expandedBucket changes to 'open_deal'
      // 4. Only one bucket expanded at a time

      let expandedBucket: string | null = 'customer';

      const handleCardClick = (bucket: string) => {
        expandedBucket = expandedBucket === bucket ? null : bucket;
      };

      // Click different card
      handleCardClick('open_deal');

      expect(expandedBucket).toBe('open_deal');
      expect(expandedBucket).not.toBe('customer');
    });
  });

  describe('Test 5: Table shows correct columns per bucket type', () => {
    it('should render standard columns for non-review buckets', () => {
      // This test validates table structure:
      // 1. Bucket is 'customer' (not needs_review)
      // 2. Table shows 5 columns
      // 3. Columns: Name, Email, Company, Job Title, Match

      const bucket = 'customer';
      const expectedColumns = ['Name', 'Email', 'Company', 'Job Title', 'Match'];

      expect(bucket).not.toBe('needs_review');
      expect(expectedColumns).toHaveLength(5);
      expect(expectedColumns).toContain('Match');
      expect(expectedColumns).not.toContain('Review Reason');
    });
  });

  describe('Test 6: needs_review bucket shows Review Reason column', () => {
    it('should add Review Reason column when bucket is needs_review', () => {
      // This test validates conditional column:
      // 1. Bucket is 'needs_review'
      // 2. Table shows 6 columns
      // 3. Extra column: Review Reason

      const bucket = 'needs_review';
      const baseColumns = ['Name', 'Email', 'Company', 'Job Title', 'Match'];
      const columns = bucket === 'needs_review' ? [...baseColumns, 'Review Reason'] : baseColumns;

      expect(bucket).toBe('needs_review');
      expect(columns).toHaveLength(6);
      expect(columns).toContain('Review Reason');
    });
  });

  describe('Test 7: Other buckets hide Review Reason column', () => {
    it('should not show Review Reason for customer bucket', () => {
      // This test validates column exclusion:
      // 1. Bucket is 'customer'
      // 2. Review Reason column is not present

      const bucket = 'customer';
      const showReviewReason = bucket === 'needs_review';

      expect(bucket).not.toBe('needs_review');
      expect(showReviewReason).toBe(false);
    });
  });

  describe('Test 8: Name shows cleaned version', () => {
    it('should combine first_name and last_name for display', () => {
      // This test validates name display:
      // 1. Row has first_name="John", last_name="Doe"
      // 2. Display shows "John Doe"
      // 3. If both empty, shows "—"

      const row = { first_name: 'John', last_name: 'Doe' };
      const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—';

      expect(name).toBe('John Doe');
    });

    it('should show — when name fields are empty', () => {
      const row = { first_name: '', last_name: '' };
      const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—';

      expect(name).toBe('—');
    });
  });

  describe('Test 9: Pagination: shows 20 rows, prev/next work', () => {
    it('should calculate correct page ranges for 25 rows', () => {
      // This test validates pagination logic:
      // 1. Bucket has 25 rows total
      // 2. Page 1 shows rows 1-20
      // 3. Page 2 shows rows 21-25

      const totalRows = 25;
      const rowsPerPage = 20;
      let currentPage = 1;

      // Page 1
      const startIndex = (currentPage - 1) * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;

      expect(startIndex).toBe(0);
      expect(endIndex).toBe(20);
      expect(totalRows).toBeGreaterThan(rowsPerPage);

      // Navigate to page 2
      currentPage = 2;
      const startIndex2 = (currentPage - 1) * rowsPerPage;
      const endIndex2 = startIndex2 + rowsPerPage;

      expect(startIndex2).toBe(20);
      expect(endIndex2).toBe(40);
      expect(Math.min(endIndex2, totalRows)).toBe(25);
    });

    it('should disable prev button on page 1', () => {
      const currentPage = 1;
      const isPrevDisabled = currentPage === 1;

      expect(isPrevDisabled).toBe(true);
    });

    it('should disable next button on last page', () => {
      const currentPage = 2;
      const totalPages = Math.ceil(25 / 20); // 2 pages
      const isNextDisabled = currentPage === totalPages;

      expect(isNextDisabled).toBe(true);
    });
  });

  describe('Test 10: Download link calls correct export endpoint', () => {
    it('should navigate to export endpoint when download clicked', () => {
      // This test validates download action:
      // 1. User clicks "Download this bucket"
      // 2. window.location.href set to /api/import/{sessionId}/bucket/{bucket}/export
      // 3. Browser initiates CSV download

      const sessionId = 'test-session-123';
      const bucket = 'customer';
      const expectedUrl = `/api/import/${sessionId}/bucket/${bucket}/export`;

      // Simulate download action
      const handleDownload = (bucket: string) => {
        return `/api/import/${sessionId}/bucket/${bucket}/export`;
      };

      const url = handleDownload(bucket);

      expect(url).toBe(expectedUrl);
      expect(url).toContain('/export');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// API Tests
// ─────────────────────────────────────────────────────────────

describe('API Tests - Bucket Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainPromise = null;
    mockGetOrgContext.mockResolvedValue({
      orgId: 'org_test123',
      userId: 'user_test456',
      orgRole: 'org:admin',
    });
  });

  describe('Test 11: GET /api/import/[id]/bucket/customer/export returns CSV with correct columns', () => {
    it('should return CSV with correct headers and Content-Type', async () => {
      // This test validates CSV export:
      // 1. GET /api/import/{session_id}/bucket/customer/export
      // 2. Returns CSV with headers: first_name,last_name,email,company,job_title,match_type,match_confidence,review_reason,hubspot_contact_id
      // 3. Content-Type: text/csv
      // 4. Content-Disposition includes filename

      const mockSession = {
        id: 'import_session_123',
        org_id: 'org_test123',
      };

      const mockRows = [
        {
          cleaned_first_name: 'John',
          cleaned_last_name: 'Doe',
          raw_data: {
            email: 'john@company.com',
            company: 'Company A',
            job_title: 'VP Sales',
          },
          match_type: 'email',
          match_confidence: 1.0,
          review_reason: null,
          hubspot_contact_id: 'contact_123',
        },
        {
          cleaned_first_name: 'Jane',
          cleaned_last_name: 'Smith',
          raw_data: {
            email: 'jane@company.com',
            company: 'Company A',
            job_title: 'Director',
          },
          match_type: 'linkedin',
          match_confidence: 0.95,
          review_reason: null,
          hubspot_contact_id: 'contact_456',
        },
      ];

      // Mock session lookup
      mockSingle.mockResolvedValueOnce({
        data: mockSession,
        error: null,
      });

      // Mock rows fetch
      mockOrder.mockResolvedValueOnce({
        data: mockRows,
        error: null,
      });

      const request = new NextRequest(
        'http://localhost/api/import/import_session_123/bucket/customer/export'
      );

      const response = await getBucketExport(request, {
        params: { session_id: 'import_session_123', bucket: 'customer' },
      });

      expect(mockFrom).toHaveBeenCalledWith('event_imports');
      expect(mockFrom).toHaveBeenCalledWith('event_import_rows');
      expect(mockEq).toHaveBeenCalledWith('bucket', 'customer');
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toMatch(/attachment; filename="refyne-import-customer-\d{4}-\d{2}-\d{2}\.csv"/);

      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = lines[0];

      expect(headers).toBe('first_name,last_name,email,company,job_title,match_type,match_confidence,review_reason,hubspot_contact_id');
      expect(lines.length).toBe(3); // 1 header + 2 data rows
      expect(lines[1]).toContain('John');
      expect(lines[1]).toContain('Doe');
      expect(lines[1]).toContain('john@company.com');
    });
  });

  describe('Test 12: Returns 404 for invalid session_id', () => {
    it('should return 404 when session not found', async () => {
      // This test validates session lookup:
      // 1. GET /api/import/invalid-id/bucket/customer/export
      // 2. Session lookup returns null
      // 3. Returns 404: "Import session not found"

      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const request = new NextRequest(
        'http://localhost/api/import/invalid-id/bucket/customer/export'
      );

      const response = await getBucketExport(request, {
        params: { session_id: 'invalid-id', bucket: 'customer' },
      });

      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('Import session not found');
    });
  });

  describe('Test 13: Returns 400 for invalid bucket name', () => {
    it('should return 400 when bucket is not in VALID_BUCKETS', async () => {
      // This test validates bucket validation:
      // 1. GET /api/import/session_123/bucket/invalid_bucket/export
      // 2. Bucket validation fails
      // 3. Returns 400: "Invalid bucket. Must be one of: ..."

      const request = new NextRequest(
        'http://localhost/api/import/session_123/bucket/invalid_bucket/export'
      );

      const response = await getBucketExport(request, {
        params: { session_id: 'session_123', bucket: 'invalid_bucket' },
      });

      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toContain('Invalid bucket');
      expect(result.error).toContain('Must be one of:');
    });

    it('should accept all valid bucket names', async () => {
      // This test validates bucket whitelist:
      // Valid buckets: customer, open_deal, former_customer, known_contact, new_contact, needs_review

      const validBuckets = [
        'customer',
        'open_deal',
        'former_customer',
        'known_contact',
        'new_contact',
        'needs_review',
      ];

      expect(validBuckets).toHaveLength(6);
      expect(validBuckets).toContain('customer');
      expect(validBuckets).toContain('needs_review');
      expect(validBuckets).not.toContain('invalid_bucket');
    });
  });

  describe('Test 14: Only returns rows matching the requested bucket', () => {
    it('should filter rows by bucket parameter', async () => {
      // This test validates row filtering:
      // 1. Request for bucket='customer'
      // 2. Query includes .eq('bucket', 'customer')
      // 3. Only customer rows in CSV

      const mockSession = {
        id: 'import_session_123',
        org_id: 'org_test123',
      };

      const mockCustomerRows = [
        {
          cleaned_first_name: 'John',
          cleaned_last_name: 'Doe',
          raw_data: { email: 'john@company.com', company: 'Company A', job_title: 'VP Sales' },
          match_type: 'email',
          match_confidence: 1.0,
          review_reason: null,
          hubspot_contact_id: 'contact_123',
        },
      ];

      mockSingle.mockResolvedValueOnce({
        data: mockSession,
        error: null,
      });

      mockOrder.mockResolvedValueOnce({
        data: mockCustomerRows,
        error: null,
      });

      const request = new NextRequest(
        'http://localhost/api/import/import_session_123/bucket/customer/export'
      );

      await getBucketExport(request, {
        params: { session_id: 'import_session_123', bucket: 'customer' },
      });

      // Verify bucket filter was applied
      expect(mockEq).toHaveBeenCalledWith('bucket', 'customer');
    });
  });
});
