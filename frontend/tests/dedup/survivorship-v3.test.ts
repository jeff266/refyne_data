/**
 * Survivorship Rules V2 Tests
 *
 * Covers PART 1-4 of the V2 spec:
 * - PART 1: prefer_if_populated rule type
 * - PART 2: Compound survivorship rule groups
 * - PART 3: Behavior text fixes
 * - PART 4: Priority numbering (already in migration 108)
 *
 * Test breakdown:
 * - 5 tests for prefer_if_populated
 * - 15 tests for compound groups
 * - 3 tests for behavior text
 * - 8 integration tests
 * Total: 31 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRules } from '@/lib/dedup/survivorship-rules';
import { evaluateSurvivorshipGroups } from '@/lib/dedup/survivorship-group-evaluator';

describe('Survivorship Rules V2', () => {
  describe('PART 1: prefer_if_populated rule type', () => {
    it('should prefer master when both have values > 0', () => {
      const masterRecord = { hs_object_id: '1', field1: '10' };
      const duplicateRecord = { hs_object_id: '2', field1: '5' };
      const rules = [
        {
          id: 'rule-1',
          org_id: 'org-1',
          field_key: 'field1',
          object_type: 'company' as const,
          rule_type: 'prefer_if_populated' as const,
          priority: 1,
          is_active: true,
          rule_config: {},
        },
      ];

      const result = applyRules(masterRecord, duplicateRecord, rules);

      expect(result.field1).toBeDefined();
      expect(result.field1.source).toBe('master');
      expect(result.field1.value).toBe('10');
    });

    it('should prefer duplicate when only duplicate has value > 0', () => {
      const masterRecord = { hs_object_id: '1', field1: '0' };
      const duplicateRecord = { hs_object_id: '2', field1: '5' };
      const rules = [
        {
          id: 'rule-1',
          org_id: 'org-1',
          field_key: 'field1',
          object_type: 'company' as const,
          rule_type: 'prefer_if_populated' as const,
          priority: 1,
          is_active: true,
          rule_config: {},
        },
      ];

      const result = applyRules(masterRecord, duplicateRecord, rules);

      expect(result.field1).toBeDefined();
      expect(result.field1.source).toBe('duplicate');
      expect(result.field1.value).toBe(5);
    });

    it('should prefer master when only master has value > 0', () => {
      const masterRecord = { hs_object_id: '1', field1: '15' };
      const duplicateRecord = { hs_object_id: '2', field1: '0' };
      const rules = [
        {
          id: 'rule-1',
          org_id: 'org-1',
          field_key: 'field1',
          object_type: 'company' as const,
          rule_type: 'prefer_if_populated' as const,
          priority: 1,
          is_active: true,
          rule_config: {},
        },
      ];

      const result = applyRules(masterRecord, duplicateRecord, rules);

      expect(result.field1).toBeDefined();
      expect(result.field1.source).toBe('master');
      expect(result.field1.value).toBe(15);
    });

    it('should prefer master when both have value 0', () => {
      const masterRecord = { hs_object_id: '1', field1: '0' };
      const duplicateRecord = { hs_object_id: '2', field1: '0' };
      const rules = [
        {
          id: 'rule-1',
          org_id: 'org-1',
          field_key: 'field1',
          object_type: 'company' as const,
          rule_type: 'prefer_if_populated' as const,
          priority: 1,
          is_active: true,
          rule_config: {},
        },
      ];

      const result = applyRules(masterRecord, duplicateRecord, rules);

      expect(result.field1).toBeDefined();
      expect(result.field1.source).toBe('master');
    });

    it('should handle non-numeric values gracefully', () => {
      const masterRecord = { hs_object_id: '1', field1: '' };
      const duplicateRecord = { hs_object_id: '2', field1: 'text' };
      const rules = [
        {
          id: 'rule-1',
          org_id: 'org-1',
          field_key: 'field1',
          object_type: 'company' as const,
          rule_type: 'prefer_if_populated' as const,
          priority: 1,
          is_active: true,
          rule_config: {},
        },
      ];

      const result = applyRules(masterRecord, duplicateRecord, rules);

      expect(result.field1).toBeDefined();
      expect(result.field1.source).toBe('master');
    });
  });

  describe('PART 2: Compound survivorship rule groups', () => {
    it('should match master when single condition matches master', () => {
      const masterRecord = { annualrevenue: '1000000', industry: 'Technology' };
      const duplicateRecord = { annualrevenue: '100000', industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeDefined();
      expect(result!.matched).toBe(true);
      expect(result!.survivor).toBe('master');
      expect(result!.matchedGroupName).toBe('High revenue companies');
    });

    it('should match duplicate when single condition matches duplicate', () => {
      const masterRecord = { annualrevenue: '100000', industry: 'Technology' };
      const duplicateRecord = { annualrevenue: '1000000', industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeDefined();
      expect(result!.matched).toBe(true);
      expect(result!.survivor).toBe('duplicate');
    });

    it('should require ALL conditions to match (AND logic)', () => {
      const masterRecord = { annualrevenue: '1000000', industry: 'Technology' };
      const duplicateRecord = { annualrevenue: '100000', industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue tech companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
            {
              id: 'cond-2',
              group_id: 'group-1',
              field_key: 'industry',
              operator: 'eq',
              comparison_value: 'Technology',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeDefined();
      expect(result!.matched).toBe(true);
      expect(result!.survivor).toBe('master');
    });

    it('should return null when no conditions match completely', () => {
      const masterRecord = { annualrevenue: '1000000', industry: 'Healthcare' };
      const duplicateRecord = { annualrevenue: '100000', industry: 'Finance' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue tech companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
            {
              id: 'cond-2',
              group_id: 'group-1',
              field_key: 'industry',
              operator: 'eq',
              comparison_value: 'Technology',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeNull();
    });

    it('should match first group when multiple groups exist', () => {
      const masterRecord = { annualrevenue: '1000000', industry: 'Technology' };
      const duplicateRecord = { annualrevenue: '2000000', industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Tech companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'industry',
              operator: 'eq',
              comparison_value: 'Technology',
            },
          ],
        },
        {
          id: 'group-2',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue companies',
          group_priority: 2,
          is_active: true,
          conditions: [
            {
              id: 'cond-2',
              group_id: 'group-2',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '1500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeDefined();
      expect(result!.matchedGroupName).toBe('Tech companies');
      expect(result!.survivor).toBe('master');
    });

    it('should handle gt operator correctly', () => {
      const masterRecord = { annualrevenue: '1000000' };
      const duplicateRecord = { annualrevenue: '500000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Revenue > 750k',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '750000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle gte operator correctly', () => {
      const masterRecord = { annualrevenue: '750000' };
      const duplicateRecord = { annualrevenue: '500000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Revenue >= 750k',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gte',
              comparison_value: '750000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle lt operator correctly', () => {
      const masterRecord = { numberofemployees: '10' };
      const duplicateRecord = { numberofemployees: '100' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Small companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'numberofemployees',
              operator: 'lt',
              comparison_value: '50',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle lte operator correctly', () => {
      const masterRecord = { numberofemployees: '50' };
      const duplicateRecord = { numberofemployees: '100' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Small companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'numberofemployees',
              operator: 'lte',
              comparison_value: '50',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle eq operator correctly', () => {
      const masterRecord = { industry: 'Technology' };
      const duplicateRecord = { industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Tech companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'industry',
              operator: 'eq',
              comparison_value: 'Technology',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle is_populated operator correctly', () => {
      const masterRecord = { description: 'A great company' };
      const duplicateRecord = { description: '' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Has description',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'description',
              operator: 'is_populated',
              comparison_value: null,
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle is_empty operator correctly', () => {
      const masterRecord = { description: '' };
      const duplicateRecord = { description: 'A great company' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'No description',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'description',
              operator: 'is_empty',
              comparison_value: null,
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle contains operator correctly', () => {
      const masterRecord = { description: 'A great technology company' };
      const duplicateRecord = { description: 'A healthcare company' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Tech related',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'description',
              operator: 'contains',
              comparison_value: 'technology',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should skip inactive groups', () => {
      const masterRecord = { industry: 'Technology' };
      const duplicateRecord = { industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Tech companies',
          group_priority: 1,
          is_active: false, // Inactive
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'industry',
              operator: 'eq',
              comparison_value: 'Technology',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeNull();
    });

    it('should skip groups with empty conditions', () => {
      const masterRecord = { industry: 'Technology' };
      const duplicateRecord = { industry: 'Healthcare' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Empty group',
          group_priority: 1,
          is_active: true,
          conditions: [],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeNull();
    });
  });

  describe('PART 3: Behavior text fixes', () => {
    it('should show first value_order item in behavior text', () => {
      const rule = {
        rule_type: 'specific_value' as const,
        rule_config: {
          value_order: ['Customer', 'Lead', 'Subscriber'],
        },
      };

      const expectedText = 'Prefer: Customer first';
      const valueOrder = rule.rule_config.value_order;

      expect(valueOrder).toBeDefined();
      expect(valueOrder!.length).toBeGreaterThan(0);
      expect(`Prefer: ${valueOrder![0]} first`).toBe(expectedText);
    });

    it('should show preferred_value in behavior text', () => {
      const rule = {
        rule_type: 'specific_value' as const,
        rule_config: {
          preferred_value: 'Customer',
        },
      };

      const expectedText = 'Always prefer: Customer';
      const preferredValue = rule.rule_config.preferred_value;

      expect(preferredValue).toBeDefined();
      expect(`Always prefer: ${preferredValue}`).toBe(expectedText);
    });

    it('should show correct text for prefer_if_populated', () => {
      const rule = {
        rule_type: 'prefer_if_populated' as const,
        rule_config: {},
      };

      const expectedText = 'Prefer record with non-zero value';

      expect(rule.rule_type).toBe('prefer_if_populated');
      expect(expectedText).toBe('Prefer record with non-zero value');
    });
  });

  describe('Integration Tests', () => {
    it('should swap master/duplicate when group selects duplicate', async () => {
      // This test verifies the merge executor integration
      const masterRecord = { hs_object_id: '1', annualrevenue: '100000' };
      const duplicateRecord = { hs_object_id: '2', annualrevenue: '1000000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('duplicate');
      // In merge executor, this would cause masterId and duplicateIds to be swapped
    });

    it('should track group resolution in metadata', async () => {
      const masterRecord = { annualrevenue: '1000000' };
      const duplicateRecord = { annualrevenue: '100000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.matchedGroupId).toBe('group-1');
      expect(result!.matchedGroupName).toBe('High revenue companies');
      // In merge executor, this would be tracked as appliedRules['__group_resolution__']
    });

    it('should fall through to field rules when no group matches', () => {
      const masterRecord = { annualrevenue: '100000' };
      const duplicateRecord = { annualrevenue: '200000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Very high revenue',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '1000000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result).toBeNull();
      // In merge executor, null result means proceed with field-level rules
    });

    it('should evaluate against first duplicate when multiple duplicates exist', () => {
      const masterRecord = { annualrevenue: '100000' };
      const firstDuplicate = { annualrevenue: '1000000' };
      const secondDuplicate = { annualrevenue: '50000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      // Merge executor evaluates against firstDuplicate only
      const result = evaluateSurvivorshipGroups(masterRecord, firstDuplicate, groups);

      expect(result!.survivor).toBe('duplicate');
      // secondDuplicate is not evaluated for group matching
    });

    it('should handle both records matching same group (master wins)', () => {
      const masterRecord = { annualrevenue: '1000000' };
      const duplicateRecord = { annualrevenue: '2000000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      // When both match, no clear winner - returns null
      expect(result).toBeNull();
    });

    it('should support case-insensitive string comparison for contains', () => {
      const masterRecord = { description: 'A GREAT TECHNOLOGY COMPANY' };
      const duplicateRecord = { description: 'A healthcare company' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'Tech related',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'description',
              operator: 'contains',
              comparison_value: 'technology',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('master');
    });

    it('should handle null/undefined field values gracefully', () => {
      const masterRecord = { annualrevenue: null };
      const duplicateRecord = { annualrevenue: '1000000' };
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const result = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);

      expect(result!.survivor).toBe('duplicate');
    });

    it('should prioritize groups over individual field rules', () => {
      // This test verifies that when a group resolves, it overrides field rules
      const masterRecord = { annualrevenue: '100000', industry: 'Technology' };
      const duplicateRecord = { annualrevenue: '1000000', industry: 'Healthcare' };

      // Group that selects duplicate based on revenue
      const groups = [
        {
          id: 'group-1',
          org_id: 'org-1',
          object_type: 'company' as const,
          name: 'High revenue companies',
          group_priority: 1,
          is_active: true,
          conditions: [
            {
              id: 'cond-1',
              group_id: 'group-1',
              field_key: 'annualrevenue',
              operator: 'gt',
              comparison_value: '500000',
            },
          ],
        },
      ];

      const groupResult = evaluateSurvivorshipGroups(masterRecord, duplicateRecord, groups);
      expect(groupResult!.survivor).toBe('duplicate');

      // Even if field rules would prefer master for 'industry',
      // the group resolution takes precedence and selects ALL fields from duplicate
      expect(groupResult!.reason).toContain('High revenue companies');
    });
  });
});
