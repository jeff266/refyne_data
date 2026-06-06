/**
 * Tests for Condition Evaluator
 *
 * Comprehensive test coverage for all 36 operators across 5 field types.
 * Tests AND/OR logic, edge cases, null handling, and type coercion.
 */

import { vi } from 'vitest';
import {
  evaluateConditionGroups,
  getConditionFields,
  countConditions,
  OPERATORS_BY_TYPE,
  type ConditionGroups,
} from './condition-evaluator';

describe('evaluateConditionGroups', () => {
  // ============================================================================
  // String Operators
  // ============================================================================

  describe('String operators', () => {
    test('equals - exact match (case insensitive)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'country',
            fieldLabel: 'Country',
            fieldType: 'string',
            operator: 'equals',
            value: 'US'
          }]
        }]
      };

      expect(evaluateConditionGroups({ country: 'US' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'us' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'UK' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ country: '' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ country: null }, groups)).toBe(false);
    });

    test('not_equals - inverse match', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'country',
            fieldLabel: 'Country',
            fieldType: 'string',
            operator: 'not_equals',
            value: 'US'
          }]
        }]
      };

      expect(evaluateConditionGroups({ country: 'UK' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'US' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ country: 'us' }, groups)).toBe(false);
    });

    test('contains - substring match', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'industry',
            fieldLabel: 'Industry',
            fieldType: 'string',
            operator: 'contains',
            value: 'tech'
          }]
        }]
      };

      expect(evaluateConditionGroups({ industry: 'Technology' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ industry: 'Fintech' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ industry: 'Finance' }, groups)).toBe(false);
    });

    test('not_contains - inverse substring', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'name',
            fieldLabel: 'Company Name',
            fieldType: 'string',
            operator: 'not_contains',
            value: 'test'
          }]
        }]
      };

      expect(evaluateConditionGroups({ name: 'Acme Corp' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ name: 'Test Company' }, groups)).toBe(false);
    });

    test('starts_with - prefix match', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'name',
            fieldLabel: 'Name',
            fieldType: 'string',
            operator: 'starts_with',
            value: 'Acme'
          }]
        }]
      };

      expect(evaluateConditionGroups({ name: 'Acme Corp' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ name: 'ACME Industries' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ name: 'The Acme Corp' }, groups)).toBe(false);
    });

    test('ends_with - suffix match', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'name',
            fieldLabel: 'Name',
            fieldType: 'string',
            operator: 'ends_with',
            value: 'Corp'
          }]
        }]
      };

      expect(evaluateConditionGroups({ name: 'Acme Corp' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ name: 'Acme corp' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ name: 'Acme Corporation' }, groups)).toBe(false);
    });

    test('is_empty - null, empty string, whitespace', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'phone',
            fieldLabel: 'Phone',
            fieldType: 'string',
            operator: 'is_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ phone: null }, groups)).toBe(true);
      expect(evaluateConditionGroups({ phone: '' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ phone: '   ' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ phone: undefined }, groups)).toBe(true);
      expect(evaluateConditionGroups({}, groups)).toBe(true);
      expect(evaluateConditionGroups({ phone: '555-1234' }, groups)).toBe(false);
    });

    test('is_not_empty - has value', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'phone',
            fieldLabel: 'Phone',
            fieldType: 'string',
            operator: 'is_not_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ phone: '555-1234' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ phone: 'x' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ phone: null }, groups)).toBe(false);
      expect(evaluateConditionGroups({ phone: '' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ phone: '   ' }, groups)).toBe(false);
    });

    test('trimmed_equals - ignores leading/trailing whitespace', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'country',
            fieldLabel: 'Country',
            fieldType: 'string',
            operator: 'trimmed_equals',
            value: '  US  '
          }]
        }]
      };

      expect(evaluateConditionGroups({ country: 'US' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: '  US' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'US  ' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: '  US  ' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'UK' }, groups)).toBe(false);
    });
  });

  // ============================================================================
  // Number Operators
  // ============================================================================

  describe('Number operators', () => {
    test('equals - exact numeric match', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'equals',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: '100' }, groups)).toBe(true); // String coercion
      expect(evaluateConditionGroups({ employees: 99 }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: 101 }, groups)).toBe(false);
    });

    test('not_equals - numeric inequality', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'not_equals',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 99 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(false);
    });

    test('gt - greater than', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'gt',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 101 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 500 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: 99 }, groups)).toBe(false);
    });

    test('gte - greater than or equal', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'gte',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 101 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 99 }, groups)).toBe(false);
    });

    test('lt - less than', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'lt',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 99 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 50 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: 101 }, groups)).toBe(false);
    });

    test('lte - less than or equal', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'lte',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 99 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 101 }, groups)).toBe(false);
    });

    test('between - range check (inclusive)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'between',
            value: [50, 200]
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 50 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 200 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 49 }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: 201 }, groups)).toBe(false);
    });

    test('between - object notation {min, max}', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'between',
            value: { min: 50, max: 200 }
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 49 }, groups)).toBe(false);
    });

    test('is_empty - null/undefined for numbers', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'is_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: null }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: undefined }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: '' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 0 }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(false);
    });

    test('is_not_empty - has numeric value', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'is_not_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: 0 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: 100 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: null }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: '' }, groups)).toBe(false);
    });

    test('numeric coercion - string to number', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'employees',
            fieldLabel: 'Employees',
            fieldType: 'number',
            operator: 'gt',
            value: 100
          }]
        }]
      };

      expect(evaluateConditionGroups({ employees: '500' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ employees: '50' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ employees: 'abc' }, groups)).toBe(false); // NaN
    });
  });

  // ============================================================================
  // Enumeration Operators
  // ============================================================================

  describe('Enumeration operators', () => {
    test('equals - single value match', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'lifecyclestage',
            fieldLabel: 'Lifecycle Stage',
            fieldType: 'enumeration',
            operator: 'equals',
            value: 'customer'
          }]
        }]
      };

      expect(evaluateConditionGroups({ lifecyclestage: 'customer' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'CUSTOMER' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'lead' }, groups)).toBe(false);
    });

    test('not_equals - single value inequality', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'lifecyclestage',
            fieldLabel: 'Lifecycle Stage',
            fieldType: 'enumeration',
            operator: 'not_equals',
            value: 'customer'
          }]
        }]
      };

      expect(evaluateConditionGroups({ lifecyclestage: 'lead' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'customer' }, groups)).toBe(false);
    });

    test('is_any_of - matches one of multiple values', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'lifecyclestage',
            fieldLabel: 'Lifecycle Stage',
            fieldType: 'enumeration',
            operator: 'is_any_of',
            value: ['customer', 'opportunity', 'lead']
          }]
        }]
      };

      expect(evaluateConditionGroups({ lifecyclestage: 'customer' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'lead' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'subscriber' }, groups)).toBe(false);
    });

    test('is_none_of - matches none of multiple values', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'lifecyclestage',
            fieldLabel: 'Lifecycle Stage',
            fieldType: 'enumeration',
            operator: 'is_none_of',
            value: ['customer', 'opportunity']
          }]
        }]
      };

      expect(evaluateConditionGroups({ lifecyclestage: 'lead' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'subscriber' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'customer' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ lifecyclestage: 'opportunity' }, groups)).toBe(false);
    });

    test('is_empty - enum field empty', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'lifecyclestage',
            fieldLabel: 'Lifecycle Stage',
            fieldType: 'enumeration',
            operator: 'is_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ lifecyclestage: null }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: '' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: 'customer' }, groups)).toBe(false);
    });

    test('is_not_empty - enum field has value', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'lifecyclestage',
            fieldLabel: 'Lifecycle Stage',
            fieldType: 'enumeration',
            operator: 'is_not_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ lifecyclestage: 'customer' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ lifecyclestage: null }, groups)).toBe(false);
    });
  });

  // ============================================================================
  // Boolean Operators
  // ============================================================================

  describe('Boolean operators', () => {
    test('is_true - boolean true', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'is_deleted',
            fieldLabel: 'Is Deleted',
            fieldType: 'bool',
            operator: 'is_true',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ is_deleted: true }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: 'true' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: '1' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: 1 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: false }, groups)).toBe(false);
      expect(evaluateConditionGroups({ is_deleted: 'false' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ is_deleted: null }, groups)).toBe(false);
    });

    test('is_false - boolean false', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'is_deleted',
            fieldLabel: 'Is Deleted',
            fieldType: 'bool',
            operator: 'is_false',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ is_deleted: false }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: 'false' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: '0' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: 0 }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: true }, groups)).toBe(false);
      expect(evaluateConditionGroups({ is_deleted: 'true' }, groups)).toBe(false);
    });

    test('is_empty - boolean field empty', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'is_deleted',
            fieldLabel: 'Is Deleted',
            fieldType: 'bool',
            operator: 'is_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ is_deleted: null }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: undefined }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: '' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ is_deleted: true }, groups)).toBe(false);
      expect(evaluateConditionGroups({ is_deleted: false }, groups)).toBe(false);
    });
  });

  // ============================================================================
  // Date Operators
  // ============================================================================

  describe('Date operators', () => {
    test('equals - same date (ignores time)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'equals',
            value: '2024-01-15'
          }]
        }]
      };

      expect(evaluateConditionGroups({ createdate: '2024-01-15' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-01-15T10:30:00Z' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-01-16' }, groups)).toBe(false);
    });

    test('before - date less than', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'before',
            value: '2024-01-15'
          }]
        }]
      };

      expect(evaluateConditionGroups({ createdate: '2024-01-14' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2023-12-31' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-01-15' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ createdate: '2024-01-16' }, groups)).toBe(false);
    });

    test('after - date greater than', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'after',
            value: '2024-01-15'
          }]
        }]
      };

      expect(evaluateConditionGroups({ createdate: '2024-01-16' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-02-01' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-01-15' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ createdate: '2024-01-14' }, groups)).toBe(false);
    });

    test('between - date range (inclusive)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'between',
            value: ['2024-01-01', '2024-01-31']
          }]
        }]
      };

      expect(evaluateConditionGroups({ createdate: '2024-01-01' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-01-15' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2024-01-31' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2023-12-31' }, groups)).toBe(false);
      expect(evaluateConditionGroups({ createdate: '2024-02-01' }, groups)).toBe(false);
    });

    test('between - object notation {from, to}', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'between',
            value: { from: '2024-01-01', to: '2024-01-31' }
          }]
        }]
      };

      expect(evaluateConditionGroups({ createdate: '2024-01-15' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: '2023-12-31' }, groups)).toBe(false);
    });

    test('in_last_n_days - relative date range', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'in_last_n_days',
            value: 30
          }]
        }]
      };

      const today = new Date();
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(today.getDate() - 20);
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(today.getDate() - 40);

      expect(evaluateConditionGroups({ createdate: today.toISOString() }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: twentyDaysAgo.toISOString() }, groups)).toBe(true);
      expect(evaluateConditionGroups({ createdate: fortyDaysAgo.toISOString() }, groups)).toBe(false);
    });

    test('is_empty - date field empty', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'closedate',
            fieldLabel: 'Close Date',
            fieldType: 'date',
            operator: 'is_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ closedate: null }, groups)).toBe(true);
      expect(evaluateConditionGroups({ closedate: '' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ closedate: undefined }, groups)).toBe(true);
      expect(evaluateConditionGroups({ closedate: '2024-01-15' }, groups)).toBe(false);
    });

    test('is_not_empty - date field has value', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'closedate',
            fieldLabel: 'Close Date',
            fieldType: 'date',
            operator: 'is_not_empty',
            value: null
          }]
        }]
      };

      expect(evaluateConditionGroups({ closedate: '2024-01-15' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ closedate: null }, groups)).toBe(false);
      expect(evaluateConditionGroups({ closedate: '' }, groups)).toBe(false);
    });
  });

  // ============================================================================
  // AND/OR Logic
  // ============================================================================

  describe('AND/OR logic', () => {
    test('match all - all conditions must pass (AND)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [
            {
              field: 'country',
              fieldLabel: 'Country',
              fieldType: 'string',
              operator: 'equals',
              value: 'US'
            },
            {
              field: 'lifecyclestage',
              fieldLabel: 'Lifecycle Stage',
              fieldType: 'enumeration',
              operator: 'equals',
              value: 'customer'
            }
          ]
        }]
      };

      expect(evaluateConditionGroups({
        country: 'US',
        lifecyclestage: 'customer'
      }, groups)).toBe(true);

      expect(evaluateConditionGroups({
        country: 'US',
        lifecyclestage: 'lead'
      }, groups)).toBe(false);

      expect(evaluateConditionGroups({
        country: 'UK',
        lifecyclestage: 'customer'
      }, groups)).toBe(false);
    });

    test('match any - one condition must pass (OR)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'any',
          conditions: [
            {
              field: 'country',
              fieldLabel: 'Country',
              fieldType: 'string',
              operator: 'equals',
              value: 'US'
            },
            {
              field: 'country',
              fieldLabel: 'Country',
              fieldType: 'string',
              operator: 'equals',
              value: 'United States'
            }
          ]
        }]
      };

      expect(evaluateConditionGroups({ country: 'US' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'United States' }, groups)).toBe(true);
      expect(evaluateConditionGroups({ country: 'UK' }, groups)).toBe(false);
    });

    test('multiple groups - match all groups (AND between groups)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [
          {
            match: 'any',
            conditions: [
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'US'
              },
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'United States'
              }
            ]
          },
          {
            match: 'all',
            conditions: [
              {
                field: 'phone',
                fieldLabel: 'Phone',
                fieldType: 'string',
                operator: 'is_not_empty',
                value: null
              }
            ]
          }
        ]
      };

      // Both groups must pass
      expect(evaluateConditionGroups({
        country: 'US',
        phone: '555-1234'
      }, groups)).toBe(true);

      // Group 1 passes, Group 2 fails
      expect(evaluateConditionGroups({
        country: 'US',
        phone: null
      }, groups)).toBe(false);

      // Group 1 fails, Group 2 passes
      expect(evaluateConditionGroups({
        country: 'UK',
        phone: '555-1234'
      }, groups)).toBe(false);
    });

    test('multiple groups - match any group (OR between groups)', () => {
      const groups: ConditionGroups = {
        match: 'any',
        groups: [
          {
            match: 'all',
            conditions: [
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'US'
              }
            ]
          },
          {
            match: 'all',
            conditions: [
              {
                field: 'lifecyclestage',
                fieldLabel: 'Lifecycle Stage',
                fieldType: 'enumeration',
                operator: 'equals',
                value: 'customer'
              }
            ]
          }
        ]
      };

      // Group 1 passes
      expect(evaluateConditionGroups({
        country: 'US',
        lifecyclestage: 'lead'
      }, groups)).toBe(true);

      // Group 2 passes
      expect(evaluateConditionGroups({
        country: 'UK',
        lifecyclestage: 'customer'
      }, groups)).toBe(true);

      // Both groups pass
      expect(evaluateConditionGroups({
        country: 'US',
        lifecyclestage: 'customer'
      }, groups)).toBe(true);

      // No groups pass
      expect(evaluateConditionGroups({
        country: 'UK',
        lifecyclestage: 'lead'
      }, groups)).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    test('null conditionGroups - always returns true', () => {
      expect(evaluateConditionGroups({}, null)).toBe(true);
      expect(evaluateConditionGroups({ country: 'US' }, null)).toBe(true);
    });

    test('missing field - treats as null', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'nonexistent_field',
            fieldLabel: 'Nonexistent',
            fieldType: 'string',
            operator: 'equals',
            value: 'test'
          }]
        }]
      };

      expect(evaluateConditionGroups({}, groups)).toBe(false);
      expect(evaluateConditionGroups({ other_field: 'test' }, groups)).toBe(false);
    });

    test('empty conditions array - group passes (vacuous truth)', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: []
        }]
      };

      // No conditions = group passes
      expect(evaluateConditionGroups({}, groups)).toBe(true);
    });

    test('empty groups array - always passes', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: []
      };

      expect(evaluateConditionGroups({}, groups)).toBe(true);
    });

    test('invalid date - condition fails with warning', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [{
          match: 'all',
          conditions: [{
            field: 'createdate',
            fieldLabel: 'Create Date',
            fieldType: 'date',
            operator: 'before',
            value: '2024-01-15'
          }]
        }]
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(evaluateConditionGroups({ createdate: 'not-a-date' }, groups)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('getConditionFields', () => {
    test('extracts all unique field names', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [
          {
            match: 'all',
            conditions: [
              { field: 'country', fieldLabel: 'Country', fieldType: 'string', operator: 'equals', value: 'US' },
              { field: 'phone', fieldLabel: 'Phone', fieldType: 'string', operator: 'is_not_empty', value: null }
            ]
          },
          {
            match: 'any',
            conditions: [
              { field: 'lifecyclestage', fieldLabel: 'Stage', fieldType: 'enumeration', operator: 'equals', value: 'customer' },
              { field: 'country', fieldLabel: 'Country', fieldType: 'string', operator: 'equals', value: 'UK' }
            ]
          }
        ]
      };

      const fields = getConditionFields(groups);
      expect(fields.size).toBe(3);
      expect(fields.has('country')).toBe(true);
      expect(fields.has('phone')).toBe(true);
      expect(fields.has('lifecyclestage')).toBe(true);
    });

    test('returns empty set for null groups', () => {
      const fields = getConditionFields(null);
      expect(fields.size).toBe(0);
    });
  });

  describe('countConditions', () => {
    test('counts total conditions across all groups', () => {
      const groups: ConditionGroups = {
        match: 'all',
        groups: [
          {
            match: 'all',
            conditions: [
              { field: 'country', fieldLabel: 'Country', fieldType: 'string', operator: 'equals', value: 'US' },
              { field: 'phone', fieldLabel: 'Phone', fieldType: 'string', operator: 'is_not_empty', value: null }
            ]
          },
          {
            match: 'any',
            conditions: [
              { field: 'lifecyclestage', fieldLabel: 'Stage', fieldType: 'enumeration', operator: 'equals', value: 'customer' }
            ]
          }
        ]
      };

      expect(countConditions(groups)).toBe(3);
    });

    test('returns 0 for null groups', () => {
      expect(countConditions(null)).toBe(0);
    });
  });

  describe('OPERATORS_BY_TYPE', () => {
    test('exports operator definitions for all field types', () => {
      expect(OPERATORS_BY_TYPE.string).toBeDefined();
      expect(OPERATORS_BY_TYPE.number).toBeDefined();
      expect(OPERATORS_BY_TYPE.enumeration).toBeDefined();
      expect(OPERATORS_BY_TYPE.bool).toBeDefined();
      expect(OPERATORS_BY_TYPE.date).toBeDefined();

      expect(OPERATORS_BY_TYPE.string.length).toBe(11);
      expect(OPERATORS_BY_TYPE.number.length).toBe(9);
      expect(OPERATORS_BY_TYPE.enumeration.length).toBe(6);
      expect(OPERATORS_BY_TYPE.bool.length).toBe(3);
      expect(OPERATORS_BY_TYPE.date.length).toBe(7);
    });
  });
});
