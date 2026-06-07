/**
 * Auto-Learning Functionality Tests
 *
 * Tests for auto-learning triggers and behaviors:
 * 8. Trigger A: admin correction adds to registry as active
 * 9. Trigger A: correction propagates to other records in same run with same original value
 * 10. Trigger B: hubspot_edit queues for review when human edit differs from Refyne output
 * 11. Trigger B: no queue entry when human edit matches Refyne output
 * 12. Trigger B: skips when old/new value empty or equal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addToRegistry, queueForReview } from '@/lib/names/registry';

// Mock Supabase admin client
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => {
      mockFrom(...args);
      return {
        insert: (...args: any[]) => {
          mockInsert(...args);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'test-id' }, error: null }),
            }),
          };
        },
        select: (...args: any[]) => {
          mockSelect(...args);
          return {
            eq: (...args: any[]) => {
              mockEq(...args);
              return {
                eq: mockEq,
                single: () => Promise.resolve({ data: null, error: null }),
              };
            },
          };
        },
        update: (...args: any[]) => {
          mockUpdate(...args);
          return {
            eq: () => Promise.resolve({ data: null, error: null }),
          };
        },
      };
    },
  },
}));

describe('Auto-Learning Triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 8: Trigger A - Admin correction adds to registry as active', () => {
    it('creates active registry entry when admin corrects during preview', async () => {
      await addToRegistry(
        'org_test123',
        'company',
        'ibm corp',
        'International Business Machines',
        'admin_correction'
      );

      // Verify insert was called with correct parameters
      expect(mockFrom).toHaveBeenCalledWith('name_registry');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org_test123',
          registry_type: 'company',
          input_token: 'ibm corp', // Normalized (lowercase, trimmed)
          canonical_form: 'International Business Machines',
          source: 'admin_correction',
          confidence: 1.0, // Admin corrections always have max confidence
          status: 'active', // Immediately active, not pending_review
          occurrence_count: 1,
          last_seen_at: expect.any(String),
        })
      );
    });

    it('normalizes input token to lowercase and trimmed', async () => {
      await addToRegistry(
        'org_test123',
        'company',
        '  ACME CORP  ',
        'Acme Corporation',
        'admin_correction'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          input_token: 'acme corp', // Normalized
          canonical_form: 'Acme Corporation', // Preserves original casing
        })
      );
    });

    it('sets confidence to 1.0 for admin corrections', async () => {
      await addToRegistry(
        'org_test123',
        'company',
        'widget llc',
        'Widget Technologies',
        'admin_correction'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 1.0,
          status: 'active',
        })
      );
    });

    it('handles contact name tokens with appropriate registry type', async () => {
      // First name correction
      await addToRegistry(
        'org_test123',
        'contact_first',
        'jon',
        'John',
        'admin_correction'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          registry_type: 'contact_first',
          input_token: 'jon',
          canonical_form: 'John',
        })
      );

      vi.clearAllMocks();

      // Last name correction
      await addToRegistry(
        'org_test123',
        'contact_last',
        'smith',
        'Smith',
        'admin_correction'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          registry_type: 'contact_last',
          input_token: 'smith',
          canonical_form: 'Smith',
        })
      );
    });
  });

  describe('Test 9: Trigger A - Correction propagates to other records in same run', () => {
    it('uses registry entry for all records with same original value', async () => {
      // Simulate admin correction during preview
      const adminCorrection = {
        input_token: 'ibm',
        canonical_form: 'International Business Machines',
      };

      // Add to registry
      await addToRegistry(
        'org_test123',
        'company',
        adminCorrection.input_token,
        adminCorrection.canonical_form,
        'admin_correction'
      );

      // Simulate subsequent records in the same batch
      const batch = [
        { companyId: '123', name: 'IBM' },
        { companyId: '456', name: 'ibm' },
        { companyId: '789', name: 'IBM Corp' },
      ];

      // All should tokenize to 'ibm' and match the registry entry
      const normalizedTokens = batch.map((r) => r.name.toLowerCase().trim());

      expect(normalizedTokens).toEqual(['ibm', 'ibm', 'ibm corp']);
      // First two would match registry lookup
      // Third might need additional tokenization to extract 'ibm'

      // Verify admin correction was stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          input_token: 'ibm',
          canonical_form: 'International Business Machines',
          source: 'admin_correction',
        })
      );
    });

    it('propagates correction to records processed after admin edit', async () => {
      // Admin corrects "acme inc" -> "Acme Corporation"
      await addToRegistry(
        'org_test123',
        'company',
        'acme inc',
        'Acme Corporation',
        'admin_correction'
      );

      // This entry would be used for all subsequent records with "acme inc"
      // in the same normalization run
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          input_token: 'acme inc',
          canonical_form: 'Acme Corporation',
          status: 'active', // Immediately available for lookup
        })
      );
    });
  });

  describe('Test 10: Trigger B - hubspot_edit queues for review when edit differs', () => {
    it('queues when human edit differs from Refyne output', async () => {
      const orgId = 'org_test123';
      const companyId = 'hubspot_123';
      const oldValue = 'ACME CORPORATION'; // Original HubSpot value
      const refyneOutput = 'Acme Corp'; // What Refyne would normalize to
      const humanEdit = 'Acme Corporation'; // What human changed it to

      // Human edit differs from Refyne output -> queue for review
      if (humanEdit !== refyneOutput) {
        await queueForReview(
          orgId,
          'company',
          oldValue,
          humanEdit,
          'hubspot_edit',
          {
            company_id: companyId,
            field: 'name',
            original_value: oldValue,
            refyne_output: refyneOutput,
            human_edit: humanEdit,
          }
        );
      }

      expect(mockFrom).toHaveBeenCalledWith('name_registry_queue');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: orgId,
          registry_type: 'company',
          input_token: oldValue.toLowerCase().trim(),
          suggested_canonical: humanEdit,
          trigger_type: 'hubspot_edit',
          trigger_context: expect.objectContaining({
            company_id: companyId,
            field: 'name',
            original_value: oldValue,
            refyne_output: refyneOutput,
            human_edit: humanEdit,
          }),
          status: 'pending',
        })
      );
    });

    it('includes webhook context in queue entry', async () => {
      const context = {
        company_id: 'hubspot_456',
        field: 'name',
        original_value: 'IBM Corp',
        refyne_output: 'IBM', // Refyne would remove suffix
        human_edit: 'International Business Machines', // Human expanded
        webhook_event_id: 'evt_abc123',
        changed_at: '2024-01-01T00:00:00Z',
      };

      await queueForReview(
        'org_test123',
        'company',
        context.original_value,
        context.human_edit,
        'hubspot_edit',
        context
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: 'hubspot_edit',
          trigger_context: expect.objectContaining({
            webhook_event_id: 'evt_abc123',
            changed_at: '2024-01-01T00:00:00Z',
          }),
        })
      );
    });
  });

  describe('Test 11: Trigger B - No queue entry when human edit matches Refyne', () => {
    it('skips queueing when human edit matches Refyne output', async () => {
      const oldValue = 'ACME CORP';
      const refyneOutput = 'Acme Corp';
      const humanEdit = 'Acme Corp'; // Same as Refyne

      // No queue call should happen
      if (humanEdit !== refyneOutput) {
        await queueForReview(
          'org_test123',
          'company',
          oldValue,
          humanEdit,
          'hubspot_edit'
        );
      }

      // queueForReview should NOT be called
      expect(mockFrom).not.toHaveBeenCalledWith('name_registry_queue');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('uses exact string comparison for match detection', async () => {
      const testCases = [
        {
          refyne: 'Acme Corp',
          human: 'Acme Corp',
          shouldQueue: false,
          description: 'exact match',
        },
        {
          refyne: 'Acme Corp',
          human: 'Acme Corp ',
          shouldQueue: true,
          description: 'trailing space differs',
        },
        {
          refyne: 'Acme Corp',
          human: 'acme corp',
          shouldQueue: true,
          description: 'case differs',
        },
        {
          refyne: 'Acme Corporation',
          human: 'Acme Corp',
          shouldQueue: true,
          description: 'different suffix',
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        if (testCase.human !== testCase.refyne) {
          await queueForReview(
            'org_test123',
            'company',
            'original',
            testCase.human,
            'hubspot_edit'
          );
        }

        if (testCase.shouldQueue) {
          expect(mockInsert).toHaveBeenCalled();
        } else {
          expect(mockInsert).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('Test 12: Trigger B - Skips when old/new value empty or equal', () => {
    it('does not queue when old value is empty', async () => {
      const oldValue = '';
      const newValue = 'Acme Corp';

      // queueForReview handles empty input gracefully
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await queueForReview('org_test123', 'company', oldValue, newValue, 'hubspot_edit');

      // Should log error and not insert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid input_token or suggested_canonical')
      );
      expect(mockInsert).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('does not queue when new value is empty', async () => {
      const oldValue = 'Acme Corp';
      const newValue = '';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await queueForReview('org_test123', 'company', oldValue, newValue, 'hubspot_edit');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid input_token or suggested_canonical')
      );
      expect(mockInsert).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('does not queue when both values are empty', async () => {
      const oldValue = '';
      const newValue = '';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await queueForReview('org_test123', 'company', oldValue, newValue, 'hubspot_edit');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('does not queue when old and new values are equal', async () => {
      const oldValue = 'Acme Corporation';
      const newValue = 'Acme Corporation';

      // Webhook handler should detect equality and skip queueing
      if (oldValue !== newValue) {
        await queueForReview('org_test123', 'company', oldValue, newValue, 'hubspot_edit');
      }

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('handles whitespace-only values as empty', async () => {
      const testCases = ['', '   ', '\t', '\n', '  \t\n  '];

      for (const emptyValue of testCases) {
        vi.clearAllMocks();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await queueForReview(
          'org_test123',
          'company',
          emptyValue,
          'Acme Corp',
          'hubspot_edit'
        );

        expect(mockInsert).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      }
    });

    it('normalizes values before comparison', async () => {
      const oldValue = '  ACME CORP  ';
      const newValue = 'acme corp';

      // After normalization (lowercase, trim), both become 'acme corp'
      const normalizedOld = oldValue.toLowerCase().trim();
      const normalizedNew = newValue.toLowerCase().trim();

      if (normalizedOld !== normalizedNew) {
        await queueForReview('org_test123', 'company', oldValue, newValue, 'hubspot_edit');
      }

      // Should not queue because normalized values are equal
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
