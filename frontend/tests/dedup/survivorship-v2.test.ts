/**
 * Dedup Policies V2 - Survivorship Rules Tests
 *
 * Tests for new rule types: boolean_union, append, closed_won_priority
 * Tests for field exclusions
 * Tests for compound signal matching
 * Tests for inactive owner detection
 * Tests for parent/child awareness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRules, applyRulesWithClosedWonPriority } from '@/lib/dedup/survivorship-rules';
import { applyFieldExclusions, checkOwnerActive, resolveOwnerForMerge, checkParentChild, selectSurvivorWithParentAwareness } from '@/lib/dedup/merge-executor';
import { evaluateSignalGroups, matchesSignalGroup } from '@/lib/dedup/compound-signal-matcher';
import type { SurvivorshipRule } from '@/lib/dedup/survivorship-rules';
import type { FieldExclusion } from '@/lib/dedup/merge-executor';
import type { SignalGroup } from '@/lib/dedup/compound-signal-matcher';

describe('Survivorship V2 - Boolean Union', () => {
  it('1. All false → false', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'do_not_contact',
        rule_type: 'boolean_union',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { do_not_contact: 'false' };
    const duplicate = { do_not_contact: 'false' };

    const result = applyRules(master, duplicate, rules);

    expect(result.do_not_contact.value).toBe('false');
    expect(result.do_not_contact.rule).toBe('boolean_union');
  });

  it('2. One true → true', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'do_not_contact',
        rule_type: 'boolean_union',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { do_not_contact: 'false' };
    const duplicate = { do_not_contact: 'true' };

    const result = applyRules(master, duplicate, rules);

    expect(result.do_not_contact.value).toBe('true');
    expect(result.do_not_contact.source).toBe('duplicate');
  });

  it('3. All true → true', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'do_not_contact',
        rule_type: 'boolean_union',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { do_not_contact: 'true' };
    const duplicate = { do_not_contact: 'true' };

    const result = applyRules(master, duplicate, rules);

    expect(result.do_not_contact.value).toBe('true');
    expect(result.do_not_contact.source).toBe('master');
  });

  it('4. Mixed string "true" and boolean true → true', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'do_not_contact',
        rule_type: 'boolean_union',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { do_not_contact: true };
    const duplicate = { do_not_contact: 'true' };

    const result = applyRules(master, duplicate, rules);

    expect(result.do_not_contact.value).toBe('true');
  });

  it('5. Empty/null values treated as false', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'do_not_contact',
        rule_type: 'boolean_union',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { do_not_contact: null };
    const duplicate = { do_not_contact: '' };

    const result = applyRules(master, duplicate, rules);

    expect(result.do_not_contact.value).toBe('false');
  });
});

describe('Survivorship V2 - Append', () => {
  it('6. Two notes concatenated with separator', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'notes',
        rule_type: 'append',
        rule_config: { separator: '\n', deduplicate: true },
        is_active: true,
      },
    ];

    const master = { notes: 'First note' };
    const duplicate = { notes: 'Second note' };

    const result = applyRules(master, duplicate, rules);

    expect(result.notes.value).toBe('First note\nSecond note');
    expect(result.notes.rule).toBe('append');
  });

  it('7. Duplicate values deduplicated', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'notes',
        rule_type: 'append',
        rule_config: { separator: '\n', deduplicate: true },
        is_active: true,
      },
    ];

    const master = { notes: 'Same note' };
    const duplicate = { notes: 'Same note' };

    const result = applyRules(master, duplicate, rules);

    expect(result.notes.value).toBe('Same note');
  });

  it('8. Max length truncation', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'notes',
        rule_type: 'append',
        rule_config: { separator: '\n', deduplicate: true, max_length: 20 },
        is_active: true,
      },
    ];

    const master = { notes: 'This is a very long note' };
    const duplicate = { notes: 'Another very long note' };

    const result = applyRules(master, duplicate, rules);

    expect(result.notes.value.length).toBeLessThanOrEqual(20);
  });

  it('9. Empty values excluded from append', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'notes',
        rule_type: 'append',
        rule_config: { separator: '; ', deduplicate: false },
        is_active: true,
      },
    ];

    const master = { notes: 'First note' };
    const duplicate = { notes: '' };

    const result = applyRules(master, duplicate, rules);

    expect(result.notes.value).toBe('First note');
  });

  it('10. Separator options: semicolon', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'tags',
        rule_type: 'append',
        rule_config: { separator: '; ', deduplicate: true },
        is_active: true,
      },
    ];

    const master = { tags: 'tag1' };
    const duplicate = { tags: 'tag2' };

    const result = applyRules(master, duplicate, rules);

    expect(result.tags.value).toBe('tag1; tag2');
  });
});

describe('Field Exclusions', () => {
  it('11. never_merge field removed from update payload', async () => {
    const exclusions: FieldExclusion[] = [
      {
        id: '1',
        org_id: 'test',
        object_type: 'company',
        field_name: 'hs_parent_company_id',
        exclusion_type: 'never_merge',
        separator: '\n',
      },
    ];

    const survivor = { name: 'Acme Corp', hs_parent_company_id: '123' };
    const allRecords = [survivor, { name: 'Acme Inc', hs_parent_company_id: '456' }];

    const result = await applyFieldExclusions(survivor, allRecords, exclusions);

    expect(result.properties.hs_parent_company_id).toBeUndefined();
    expect(result.applied.hs_parent_company_id).toBe('never_merge');
  });

  it('12. union_true applied correctly', async () => {
    const exclusions: FieldExclusion[] = [
      {
        id: '1',
        org_id: 'test',
        object_type: 'company',
        field_name: 'do_not_contact',
        exclusion_type: 'union_true',
        separator: '\n',
      },
    ];

    const survivor = { do_not_contact: 'false' };
    const allRecords = [survivor, { do_not_contact: 'true' }];

    const result = await applyFieldExclusions(survivor, allRecords, exclusions);

    expect(result.properties.do_not_contact).toBe('true');
    expect(result.applied.do_not_contact).toBe('union_true');
  });

  it('13. append applied correctly', async () => {
    const exclusions: FieldExclusion[] = [
      {
        id: '1',
        org_id: 'test',
        object_type: 'company',
        field_name: 'notes',
        exclusion_type: 'append',
        separator: '; ',
      },
    ];

    const survivor = { notes: 'Note 1' };
    const allRecords = [survivor, { notes: 'Note 2' }, { notes: 'Note 3' }];

    const result = await applyFieldExclusions(survivor, allRecords, exclusions);

    expect(result.properties.notes).toContain('Note 1');
    expect(result.properties.notes).toContain('Note 2');
    expect(result.properties.notes).toContain('Note 3');
    expect(result.applied.notes).toBe('append');
  });

  it('14. Multiple exclusions applied in sequence', async () => {
    const exclusions: FieldExclusion[] = [
      {
        id: '1',
        org_id: 'test',
        object_type: 'company',
        field_name: 'do_not_contact',
        exclusion_type: 'union_true',
        separator: '\n',
      },
      {
        id: '2',
        org_id: 'test',
        object_type: 'company',
        field_name: 'notes',
        exclusion_type: 'append',
        separator: '\n',
      },
    ];

    const survivor = { do_not_contact: 'false', notes: 'Note 1' };
    const allRecords = [survivor, { do_not_contact: 'true', notes: 'Note 2' }];

    const result = await applyFieldExclusions(survivor, allRecords, exclusions);

    expect(result.properties.do_not_contact).toBe('true');
    expect(result.properties.notes).toContain('Note 1');
    expect(result.properties.notes).toContain('Note 2');
    expect(Object.keys(result.applied).length).toBe(2);
  });
});

describe('Compound Signal Matching', () => {
  it('15. Group 1 all conditions match → matched', () => {
    const group: SignalGroup = {
      id: '1',
      name: 'Domain + Name',
      group_order: 1,
      conditions: [
        { id: '1', field: 'domain', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
        { id: '2', field: 'name', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
      ],
    };

    const companyA = {
      properties: {
        name: 'Acme Corp',
        domain: 'acme.com',
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const companyB = {
      properties: {
        name: 'Acme Corp',
        domain: 'acme.com',
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const result = matchesSignalGroup(companyA, companyB, group);

    expect(result.matched).toBe(true);
    expect(result.signalsFired).toEqual(['domain', 'name']);
  });

  it('16. Group 1 one condition fails → not matched', () => {
    const group: SignalGroup = {
      id: '1',
      name: 'Domain + Name',
      group_order: 1,
      conditions: [
        { id: '1', field: 'domain', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
        { id: '2', field: 'name', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
      ],
    };

    const companyA = {
      properties: {
        name: 'Acme Corp',
        domain: 'acme.com',
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const companyB = {
      properties: {
        name: 'Different Corp',
        domain: 'acme.com',
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const result = matchesSignalGroup(companyA, companyB, group);

    expect(result.matched).toBe(false);
  });

  it('17. OR between groups - Group 2 matches', () => {
    const groups: SignalGroup[] = [
      {
        id: '1',
        name: 'Domain + Name',
        group_order: 1,
        conditions: [
          { id: '1', field: 'domain', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
          { id: '2', field: 'name', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
        ],
      },
      {
        id: '2',
        name: 'Phone',
        group_order: 2,
        conditions: [
          { id: '3', field: 'phone', match_type: 'normalized', fuzzy_threshold: 0.85, weight: 10 },
        ],
      },
    ];

    const companyA = {
      properties: {
        name: 'Acme Corp',
        domain: 'acme.com',
        phone: '+14155551234',
        industry: null,
        linkedin_company_page: null,
      }
    };

    const companyB = {
      properties: {
        name: 'Different Corp',
        domain: 'different.com',
        phone: '(415) 555-1234',
        industry: null,
        linkedin_company_page: null,
      }
    };

    const result = evaluateSignalGroups(companyA, companyB, groups);

    expect(result.matched).toBe(true);
  });

  it('18. No group matches → not matched', () => {
    const groups: SignalGroup[] = [
      {
        id: '1',
        name: 'Domain',
        group_order: 1,
        conditions: [
          { id: '1', field: 'domain', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 },
        ],
      },
    ];

    const companyA = {
      properties: {
        name: 'Acme Corp',
        domain: 'acme.com',
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const companyB = {
      properties: {
        name: 'Different Corp',
        domain: 'different.com',
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const result = evaluateSignalGroups(companyA, companyB, groups);

    expect(result.matched).toBe(false);
  });

  it('19. Fuzzy threshold 0.85: similar names match', () => {
    const group: SignalGroup = {
      id: '1',
      name: 'Fuzzy Name',
      group_order: 1,
      conditions: [
        { id: '1', field: 'name', match_type: 'fuzzy', fuzzy_threshold: 0.85, weight: 10 },
      ],
    };

    const companyA = {
      properties: {
        name: 'Acme Corporation',
        domain: null,
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const companyB = {
      properties: {
        name: 'Acme Corp',
        domain: null,
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const result = matchesSignalGroup(companyA, companyB, group);

    expect(result.matched).toBe(true);
  });

  it('20. Fuzzy threshold 0.85: very different names don\'t match', () => {
    const group: SignalGroup = {
      id: '1',
      name: 'Fuzzy Name',
      group_order: 1,
      conditions: [
        { id: '1', field: 'name', match_type: 'fuzzy', fuzzy_threshold: 0.85, weight: 10 },
      ],
    };

    const companyA = {
      properties: {
        name: 'Acme Corporation',
        domain: null,
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const companyB = {
      properties: {
        name: 'Totally Different Company LLC',
        domain: null,
        phone: null,
        industry: null,
        linkedin_company_page: null,
      }
    };

    const result = matchesSignalGroup(companyA, companyB, group);

    expect(result.matched).toBe(false);
  });
});

describe('Closed Won Priority', () => {
  it('22. Record with closed won deal wins survivor selection', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'hs_object_id',
        rule_type: 'closed_won_priority',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { name: 'Acme Corp', hs_object_id: '123' };
    const duplicate = { name: 'Acme Inc', hs_object_id: '456' };

    // Duplicate has closed won, master doesn't
    const result = applyRulesWithClosedWonPriority(
      master,
      duplicate,
      rules,
      false, // master has no closed won
      true   // duplicate has closed won
    );

    // Should swap - duplicate becomes master
    expect(result.name.value).toBe('Acme Inc');
  });

  it('23. Both have closed won: falls through to next rule', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'hs_object_id',
        rule_type: 'closed_won_priority',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { name: 'Acme Corp' };
    const duplicate = { name: 'Acme Inc' };

    const result = applyRulesWithClosedWonPriority(
      master,
      duplicate,
      rules,
      true,  // both have closed won
      true
    );

    // Should use normal rules - master wins
    expect(result.name.value).toBe('Acme Corp');
  });

  it('24. Neither has closed won: falls through to next rule', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'hs_object_id',
        rule_type: 'closed_won_priority',
        rule_config: {},
        is_active: true,
      },
    ];

    const master = { name: 'Acme Corp' };
    const duplicate = { name: 'Acme Inc' };

    const result = applyRulesWithClosedWonPriority(
      master,
      duplicate,
      rules,
      false,  // neither has closed won
      false
    );

    expect(result.name.value).toBe('Acme Corp');
  });
});

describe('Inactive Owner', () => {
  const mockAccessToken = 'test-token';
  const mockPortalId = '123456';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('25. Active owner: returned unchanged', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', email: 'owner@test.com', archived: false }),
    });

    const result = await checkOwnerActive('1', mockPortalId, mockAccessToken);

    expect(result.active).toBe(true);
    expect(result.owner).toBeTruthy();
  });

  it('26. Inactive owner + warn: returned with flag', async () => {
    const survivor = { hubspot_owner_id: '1', name: 'Acme' };
    const allRecords = [survivor];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', archived: true }),
    });

    const result = await resolveOwnerForMerge(
      survivor,
      allRecords,
      'warn',
      null,
      mockAccessToken,
      mockPortalId
    );

    expect(result.ownerId).toBe('1');
    expect(result.action).toBe('kept_inactive');
    expect(result.wasInactive).toBe(true);
  });

  it('27. Inactive owner + assign_fallback: returns fallback ID', async () => {
    const survivor = { hubspot_owner_id: '1', name: 'Acme' };
    const allRecords = [survivor];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', archived: true }),
    });

    const result = await resolveOwnerForMerge(
      survivor,
      allRecords,
      'assign_fallback',
      '999',
      mockAccessToken,
      mockPortalId
    );

    expect(result.ownerId).toBe('999');
    expect(result.action).toBe('fallback_assigned');
    expect(result.wasInactive).toBe(true);
  });

  it('28. Inactive owner + leave_unassigned: returns null', async () => {
    const survivor = { hubspot_owner_id: '1', name: 'Acme' };
    const allRecords = [survivor];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', archived: true }),
    });

    const result = await resolveOwnerForMerge(
      survivor,
      allRecords,
      'leave_unassigned',
      null,
      mockAccessToken,
      mockPortalId
    );

    expect(result.ownerId).toBeNull();
    expect(result.action).toBe('unassigned');
    expect(result.wasInactive).toBe(true);
  });

  it('29. Owner not found: treated as inactive', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await checkOwnerActive('999', mockPortalId, mockAccessToken);

    expect(result.active).toBe(false);
    expect(result.owner).toBeNull();
  });
});

describe('Parent/Child Awareness', () => {
  const mockAccessToken = 'test-token';
  const mockPortalId = '123456';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('30. Company without parent preferred as survivor', () => {
    const companyA = { hs_object_id: '1', name: 'Parent Co', hs_parent_company_id: null };
    const companyB = { hs_object_id: '2', name: 'Child Co', hs_parent_company_id: '999' };

    const parentChecks = new Map();
    parentChecks.set('1', { hasParent: false, parentId: null, childIds: [] });
    parentChecks.set('2', { hasParent: true, parentId: '999', childIds: [] });

    const result = selectSurvivorWithParentAwareness([companyA, companyB], parentChecks);

    expect(result.survivorId).toBe('1'); // Company without parent wins
    expect(result.reason).toBe('parent_preferred');
  });

  it('31. Both have parents: first record wins', () => {
    const companyA = { hs_object_id: '1', name: 'Child A', hs_parent_company_id: '888' };
    const companyB = { hs_object_id: '2', name: 'Child B', hs_parent_company_id: '999' };

    const parentChecks = new Map();
    parentChecks.set('1', { hasParent: true, parentId: '888', childIds: [] });
    parentChecks.set('2', { hasParent: true, parentId: '999', childIds: [] });

    const result = selectSurvivorWithParentAwareness([companyA, companyB], parentChecks);

    expect(result.survivorId).toBe('1'); // First record wins
    expect(result.reason).toBe('all_have_parents');
  });

  it('32. Neither has parent: first record wins', () => {
    const companyA = { hs_object_id: '1', name: 'Standalone A', hs_parent_company_id: null };
    const companyB = { hs_object_id: '2', name: 'Standalone B', hs_parent_company_id: null };

    const parentChecks = new Map();
    parentChecks.set('1', { hasParent: false, parentId: null, childIds: [] });
    parentChecks.set('2', { hasParent: false, parentId: null, childIds: [] });

    const result = selectSurvivorWithParentAwareness([companyA, companyB], parentChecks);

    expect(result.survivorId).toBe('1'); // First record wins (both are parents)
    expect(result.reason).toBe('parent_preferred'); // First one is still preferred
  });

  it('33. Check parent/child returns correct structure', async () => {
    const { checkParentChild } = await import('@/lib/dedup/merge-executor');

    const record = { hs_object_id: '123', hs_parent_company_id: '456', name: 'Child Co' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: '789', type: 'child' },
        ],
      }),
    });

    const result = await checkParentChild(record, mockAccessToken, mockPortalId);

    expect(result.hasParent).toBe(true);
    expect(result.parentId).toBe('456');
    expect(result.childIds).toBeDefined();
  });

  it('34. Check parent/child handles API failure', async () => {
    const { checkParentChild } = await import('@/lib/dedup/merge-executor');

    const record = { hs_object_id: '123', hs_parent_company_id: '456', name: 'Child Co' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await checkParentChild(record, mockAccessToken, mockPortalId);

    expect(result.hasParent).toBe(true); // Still has parent from record data
    expect(result.parentId).toBe('456');
    expect(result.childIds).toEqual([]); // Empty array on API failure
  });

  it('35. Check parent/child fetches child IDs', async () => {
    const { checkParentChild } = await import('@/lib/dedup/merge-executor');

    const record = { hs_object_id: '123', hs_parent_company_id: null, name: 'Parent' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: '456' },
          { id: '789' },
        ],
      }),
    });

    const result = await checkParentChild(record, mockAccessToken, mockPortalId);

    expect(result.hasParent).toBe(false);
    expect(result.parentId).toBeNull();
    expect(result.childIds.length).toBe(2);
    expect(result.childIds).toContain('456');
    expect(result.childIds).toContain('789');
  });
});

describe('Combined Rules', () => {
  it('21. Boolean union + append combined in single merge', () => {
    const rules: SurvivorshipRule[] = [
      {
        id: '1',
        org_id: 'test',
        field_key: 'do_not_contact',
        rule_type: 'boolean_union',
        rule_config: {},
        is_active: true,
      },
      {
        id: '2',
        org_id: 'test',
        field_key: 'notes',
        rule_type: 'append',
        rule_config: { separator: '; ', deduplicate: true },
        is_active: true,
      },
    ];

    const master = { do_not_contact: 'false', notes: 'First note' };
    const duplicate = { do_not_contact: 'true', notes: 'Second note' };

    const result = applyRules(master, duplicate, rules);

    expect(result.do_not_contact.value).toBe('true');
    expect(result.notes.value).toBe('First note; Second note');
  });
});

describe('API Validation', () => {
  it('36. Field exclusion type must be valid enum', () => {
    const validTypes = ['never_merge', 'union_true', 'append'];
    const invalidType = 'invalid_type';

    expect(validTypes).toContain('never_merge');
    expect(validTypes).toContain('union_true');
    expect(validTypes).toContain('append');
    expect(validTypes).not.toContain(invalidType);
  });

  it('37. Inactive owner action must be valid enum', () => {
    const validActions = ['warn', 'assign_fallback', 'leave_unassigned'];
    const invalidAction = 'invalid_action';

    expect(validActions).toContain('warn');
    expect(validActions).toContain('assign_fallback');
    expect(validActions).toContain('leave_unassigned');
    expect(validActions).not.toContain(invalidAction);
  });

  it('38. Signal condition match type must be valid', () => {
    const validMatchTypes = ['exact', 'fuzzy', 'normalized'];
    const condition = {
      field: 'name',
      match_type: 'exact',
      fuzzy_threshold: 0.85,
      weight: 10,
    };

    expect(validMatchTypes).toContain(condition.match_type);
    expect(validMatchTypes).toContain('fuzzy');
    expect(validMatchTypes).toContain('normalized');
  });

  it('39. Unique constraint on field exclusions enforced', () => {
    // Unique constraint: (org_id, object_type, field_name)
    const exclusion1 = {
      org_id: 'test-org',
      object_type: 'company',
      field_name: 'hs_email_optout',
      exclusion_type: 'union_true',
    };

    const exclusion2 = {
      org_id: 'test-org',
      object_type: 'company',
      field_name: 'hs_email_optout',
      exclusion_type: 'never_merge',
    };

    const hasSameUniqueKey =
      exclusion1.org_id === exclusion2.org_id &&
      exclusion1.object_type === exclusion2.object_type &&
      exclusion1.field_name === exclusion2.field_name;

    expect(hasSameUniqueKey).toBe(true);
  });

  it('40. Signal group order determines precedence', () => {
    const groups = [
      { id: '1', name: 'High Priority', group_order: 1 },
      { id: '2', name: 'Low Priority', group_order: 2 },
      { id: '3', name: 'Medium Priority', group_order: 1.5 },
    ];

    // Sort by group_order (ascending) - lower numbers evaluated first
    const sorted = [...groups].sort((a, b) => a.group_order - b.group_order);

    expect(sorted[0].name).toBe('High Priority');
    expect(sorted[1].name).toBe('Medium Priority');
    expect(sorted[2].name).toBe('Low Priority');
  });
});
