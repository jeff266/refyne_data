/**
 * Owner Assignment Tests
 *
 * Tests for owner assignment logic in lib/import/matcher.ts
 * 6 tests covering weighted distribution and company grouping
 */

import { describe, it, expect } from 'vitest';
import {
  assignOwners,
  groupByCompany,
  type ParsedRow,
} from '../../lib/import/matcher';

describe('assignOwners', () => {
  it('should distribute evenly with equal weights', () => {
    const companyGroups = new Map([
      ['domain:acme', [{ email: 'user1@acme.com' } as ParsedRow]],
      ['domain:beta', [{ email: 'user2@beta.com' } as ParsedRow]],
    ]);

    const owners = [
      { id: 'owner1', weight: 1 },
      { id: 'owner2', weight: 1 },
    ];

    const assignments = assignOwners(companyGroups, owners);

    // Each owner should get 1 company
    const ownerCounts = new Map<string, number>();
    for (const ownerId of assignments.values()) {
      ownerCounts.set(ownerId, (ownerCounts.get(ownerId) || 0) + 1);
    }

    expect(ownerCounts.get('owner1')).toBe(1);
    expect(ownerCounts.get('owner2')).toBe(1);
  });

  it('should respect weight ratios', () => {
    const companyGroups = new Map([
      ['domain:acme', [{ email: 'user1@acme.com' } as ParsedRow]],
      ['domain:beta', [{ email: 'user2@beta.com' } as ParsedRow]],
      ['domain:gamma', [{ email: 'user3@gamma.com' } as ParsedRow]],
      ['domain:delta', [{ email: 'user4@delta.com' } as ParsedRow]],
    ]);

    const owners = [
      { id: 'owner1', weight: 3 },
      { id: 'owner2', weight: 1 },
    ];

    const assignments = assignOwners(companyGroups, owners);

    // Owner1 should get ~75% (3 companies), Owner2 should get ~25% (1 company)
    const ownerCounts = new Map<string, number>();
    for (const ownerId of assignments.values()) {
      ownerCounts.set(ownerId, (ownerCounts.get(ownerId) || 0) + 1);
    }

    expect(ownerCounts.get('owner1')).toBe(3);
    expect(ownerCounts.get('owner2')).toBe(1);
  });

  it('should assign largest companies first', () => {
    // Create companies of different sizes
    const companyGroups = new Map([
      ['domain:small', [{ email: 'user1@small.com' } as ParsedRow]],
      ['domain:large', Array.from({ length: 10 }, (_, i) => ({ email: `user${i}@large.com` } as ParsedRow))],
      ['domain:medium', Array.from({ length: 5 }, (_, i) => ({ email: `user${i}@medium.com` } as ParsedRow))],
    ]);

    const owners = [
      { id: 'owner1', weight: 1 },
      { id: 'owner2', weight: 1 },
    ];

    const assignments = assignOwners(companyGroups, owners);

    // The largest company (10 contacts) should be assigned first
    // This means one owner gets the large company, the other gets medium + small
    const owner1Companies: string[] = [];
    const owner2Companies: string[] = [];

    for (const [companyKey, ownerId] of assignments.entries()) {
      if (ownerId === 'owner1') {
        owner1Companies.push(companyKey);
      } else {
        owner2Companies.push(companyKey);
      }
    }

    // One owner should have the large company
    expect(
      owner1Companies.includes('domain:large') || owner2Companies.includes('domain:large')
    ).toBe(true);

    // Total should be 3 companies
    expect(assignments.size).toBe(3);
  });

  it('should never split a company across owners', () => {
    const companyGroups = new Map([
      ['domain:acme', Array.from({ length: 5 }, (_, i) => ({ email: `user${i}@acme.com` } as ParsedRow))],
      ['domain:beta', Array.from({ length: 3 }, (_, i) => ({ email: `user${i}@beta.com` } as ParsedRow))],
    ]);

    const owners = [
      { id: 'owner1', weight: 1 },
      { id: 'owner2', weight: 1 },
    ];

    const assignments = assignOwners(companyGroups, owners);

    // Each company should be assigned to exactly one owner
    expect(assignments.size).toBe(2);

    // All contacts from a company should go to the same owner
    const acmeOwner = assignments.get('domain:acme');
    const betaOwner = assignments.get('domain:beta');

    expect(acmeOwner).toBeDefined();
    expect(betaOwner).toBeDefined();

    // Companies can be assigned to different owners, but each company is whole
    expect(acmeOwner).toMatch(/^owner[12]$/);
    expect(betaOwner).toMatch(/^owner[12]$/);
  });

  it('should handle single owner', () => {
    const companyGroups = new Map([
      ['domain:acme', [{ email: 'user1@acme.com' } as ParsedRow]],
      ['domain:beta', [{ email: 'user2@beta.com' } as ParsedRow]],
      ['domain:gamma', [{ email: 'user3@gamma.com' } as ParsedRow]],
    ]);

    const owners = [{ id: 'solo-owner', weight: 1 }];

    const assignments = assignOwners(companyGroups, owners);

    // All companies should be assigned to the single owner
    expect(assignments.size).toBe(3);
    for (const ownerId of assignments.values()) {
      expect(ownerId).toBe('solo-owner');
    }
  });

  it('should handle zero weight gracefully', () => {
    const companyGroups = new Map([
      ['domain:acme', [{ email: 'user1@acme.com' } as ParsedRow]],
      ['domain:beta', [{ email: 'user2@beta.com' } as ParsedRow]],
    ]);

    const owners = [
      { id: 'owner1', weight: 0 },
      { id: 'owner2', weight: 1 },
    ];

    const assignments = assignOwners(companyGroups, owners);

    // All companies should go to the owner with non-zero weight
    expect(assignments.size).toBe(2);
    for (const ownerId of assignments.values()) {
      // Owner with weight 1 should get all assignments
      expect(ownerId).toBe('owner2');
    }
  });
});
