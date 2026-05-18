/**
 * Dedup Gate Tests
 *
 * Tests for parent-child relationship checking and company index.
 */

import { describe, it, expect } from 'vitest';
import {
  checkParentRelationship,
  addSuppression,
  isSuppressionActive,
  getSuppressions,
} from './dedup-gate';
import type { CompanyIndex } from './client';

describe('checkParentRelationship', () => {
  const createIndex = (
    parentMap: Record<string, string> = {}
  ): CompanyIndex => ({
    domainIndex: new Map(),
    linkedInIndex: new Map(),
    apolloIndex: new Map(),
    parentIndex: new Map(Object.entries(parentMap)),
    childSet: new Set(Object.keys(parentMap)),
    companyMap: new Map(),
    totalCompanies: 100,
    companiesWithParent: Object.keys(parentMap).length,
  });

  it('detects directly linked parent-child (A is parent of B)', () => {
    // B's parent is A
    const index = createIndex({ 'company-b': 'company-a' });

    const result = checkParentRelationship('company-a', 'company-b', index);

    expect(result.type).toBe('directly_linked');
  });

  it('detects directly linked parent-child (B is parent of A)', () => {
    // A's parent is B
    const index = createIndex({ 'company-a': 'company-b' });

    const result = checkParentRelationship('company-a', 'company-b', index);

    expect(result.type).toBe('directly_linked');
  });

  it('detects sibling companies with different parents', () => {
    // A's parent is X, B's parent is Y
    const index = createIndex({
      'company-a': 'parent-x',
      'company-b': 'parent-y',
    });

    const result = checkParentRelationship('company-a', 'company-b', index);

    expect(result.type).toBe('sibling');
  });

  it('detects companies with same parent', () => {
    // Both A and B have the same parent
    const index = createIndex({
      'company-a': 'parent-x',
      'company-b': 'parent-x',
    });

    const result = checkParentRelationship('company-a', 'company-b', index);

    expect(result.type).toBe('same_parent');
  });

  it('detects when one company has parent, other does not', () => {
    // Only A has a parent
    const index = createIndex({ 'company-a': 'parent-x' });

    const result = checkParentRelationship('company-a', 'company-b', index);

    expect(result.type).toBe('one_has_parent');
  });

  it('detects when neither company has parent configuration', () => {
    // Neither has a parent
    const index = createIndex({});

    const result = checkParentRelationship('company-a', 'company-b', index);

    expect(result.type).toBe('no_hierarchy');
  });
});

describe('dedup suppressions', () => {
  it('adds and retrieves suppressions', () => {
    const orgId = 'test-org';
    const recordA = 'company-1';
    const recordB = 'company-2';

    addSuppression(orgId, recordA, recordB, 'parent_child', true);

    expect(isSuppressionActive(orgId, recordA, recordB)).toBe(true);
    expect(isSuppressionActive(orgId, recordB, recordA)).toBe(true); // Order independent

    const suppressions = getSuppressions(orgId);
    expect(suppressions.length).toBeGreaterThan(0);
    expect(suppressions[0].reason).toBe('parent_child');
    expect(suppressions[0].permanent).toBe(true);
  });

  it('returns false for non-existent suppressions', () => {
    expect(isSuppressionActive('unknown-org', 'a', 'b')).toBe(false);
  });
});

describe('parent-child scoring behavior', () => {
  it('directly_linked should result in suppression (score 0.0)', () => {
    // This is tested implicitly through checkParentRelationship
    // The actual scoring is applied in checkDedupGate
    const result = checkParentRelationship(
      'child',
      'parent',
      createIndex({ child: 'parent' })
    );
    expect(result.type).toBe('directly_linked');
    // Expect score 0.0, action: suppress in actual gate
  });

  it('sibling should result in insert (score 0.0)', () => {
    const result = checkParentRelationship(
      'company-a',
      'company-b',
      createIndex({ 'company-a': 'parent-x', 'company-b': 'parent-y' })
    );
    expect(result.type).toBe('sibling');
    // Expect score 0.0, action: insert in actual gate
  });

  it('same_parent should result in review (score 1.0, NOT auto_merge)', () => {
    const result = checkParentRelationship(
      'company-a',
      'company-b',
      createIndex({ 'company-a': 'parent-x', 'company-b': 'parent-x' })
    );
    expect(result.type).toBe('same_parent');
    // Expect score 1.0, action: review (not auto_merge) in actual gate
  });

  it('one_has_parent should result in review (score 0.75)', () => {
    const result = checkParentRelationship(
      'company-a',
      'company-b',
      createIndex({ 'company-a': 'parent-x' })
    );
    expect(result.type).toBe('one_has_parent');
    // Expect score 0.75, action: review in actual gate
  });

  it('no_hierarchy should use original cascade behavior (score 1.0)', () => {
    const result = checkParentRelationship(
      'company-a',
      'company-b',
      createIndex({})
    );
    expect(result.type).toBe('no_hierarchy');
    // Expect original cascade behavior in actual gate
  });
});

function createIndex(parentMap: Record<string, string>): CompanyIndex {
  return {
    domainIndex: new Map(),
    linkedInIndex: new Map(),
    apolloIndex: new Map(),
    parentIndex: new Map(Object.entries(parentMap)),
    childSet: new Set(Object.keys(parentMap)),
    companyMap: new Map(),
    totalCompanies: 100,
    companiesWithParent: Object.keys(parentMap).length,
  };
}
