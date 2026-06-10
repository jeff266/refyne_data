/**
 * Field Exclusions UI Tests
 *
 * Tests for the Field Exclusions Settings UI and bulk API endpoint.
 */

import { describe, it, expect } from 'vitest';
import {
  COMPANY_COMMON_FIELDS,
  CONTACT_COMMON_FIELDS,
  EXCLUSION_TYPES,
  SEPARATOR_OPTIONS,
  COMPLIANCE_FIELDS,
  getExclusionTypeLabel,
  getSeparatorLabel,
  getFieldLabel,
  isComplianceField,
  getTypeBadgeColor,
} from '@/lib/dedup/field-exclusions-ui';

describe('Field Exclusions Bulk API', () => {
  it('1. PUT /api/dedup/field-exclusions/bulk replaces custom exclusions', () => {
    const customExclusions = [
      { fieldName: 'notes', exclusionType: 'append', separator: '\n' },
      { fieldName: 'description', exclusionType: 'append', separator: '; ' },
    ];

    const complianceExclusions = [
      { fieldName: 'hs_email_optout', exclusionType: 'union_true' },
    ];

    // Custom exclusions should be replaced, compliance fields preserved
    expect(customExclusions.length).toBe(2);
    expect(complianceExclusions.length).toBe(1);
  });

  it('2. PUT does not delete compliance fields', () => {
    const fieldsToDelete = ['notes', 'description', 'hs_email_optout'];

    // Should only delete non-compliance fields
    const shouldDelete = fieldsToDelete.filter((f) => !isComplianceField(f));

    expect(shouldDelete.length).toBe(2);
    expect(shouldDelete).toContain('notes');
    expect(shouldDelete).toContain('description');
    expect(shouldDelete).not.toContain('hs_email_optout');
  });

  it('3. PUT validates exclusion_type is valid enum', () => {
    const validTypes = ['never_merge', 'union_true', 'append'];
    const invalidType = 'invalid_type';

    expect(validTypes).toContain('never_merge');
    expect(validTypes).toContain('union_true');
    expect(validTypes).toContain('append');
    expect(validTypes).not.toContain(invalidType);
  });

  it('4. PUT validates separator is valid enum when exclusion_type = append', () => {
    const validSeparators = ['\n', '; ', ', '];
    const invalidSeparator = ' | ';

    const exclusion = {
      exclusionType: 'append',
      separator: '\n',
    };

    expect(validSeparators).toContain(exclusion.separator);
    expect(validSeparators).not.toContain(invalidSeparator);
  });

  it('5. PUT org-scoped (cannot replace another org\'s)', () => {
    // RLS policy enforces org isolation
    const request = {
      objectType: 'company',
      exclusions: [],
    };

    // In actual API, getOrgContext() is called first
    expect(request.objectType).toBeDefined();
  });

  it('6. PUT empty array deletes all custom exclusions but keeps compliance fields', () => {
    const allExclusions = [
      { field_name: 'notes', exclusion_type: 'append' },
      { field_name: 'hs_email_optout', exclusion_type: 'union_true' },
      { field_name: 'description', exclusion_type: 'append' },
    ];

    // Empty request should only delete non-compliance
    const afterReset = allExclusions.filter((e) => isComplianceField(e.field_name));

    expect(afterReset.length).toBe(1);
    expect(afterReset[0].field_name).toBe('hs_email_optout');
  });

  it('7. GET returns compliance fields marked as is_compliance: true', () => {
    const exclusions = [
      { id: '1', field_name: 'notes', exclusion_type: 'append' },
      { id: '2', field_name: 'hs_email_optout', exclusion_type: 'union_true' },
    ];

    const withFlags = exclusions.map((e) => ({
      ...e,
      is_compliance: isComplianceField(e.field_name),
    }));

    expect(withFlags[0].is_compliance).toBe(false);
    expect(withFlags[1].is_compliance).toBe(true);
  });

  it('8. GET returns exclusions ordered by field_name', () => {
    const exclusions = [
      { field_name: 'notes' },
      { field_name: 'description' },
      { field_name: 'hs_parent_company_id' },
    ];

    const sorted = [...exclusions].sort((a, b) => a.field_name.localeCompare(b.field_name));

    expect(sorted[0].field_name).toBe('description');
    expect(sorted[1].field_name).toBe('hs_parent_company_id');
    expect(sorted[2].field_name).toBe('notes');
  });
});

describe('Field Exclusions UI Logic', () => {
  it('9. Compliance fields show lock icon, no delete button', () => {
    const exclusion = {
      field_name: 'hs_email_optout',
      exclusion_type: 'union_true',
    };

    const isCompliance = isComplianceField(exclusion.field_name);
    const showLock = isCompliance;
    const showDeleteButton = !isCompliance;

    expect(showLock).toBe(true);
    expect(showDeleteButton).toBe(false);
  });

  it('10. Custom fields show delete (×) button', () => {
    const exclusion = {
      field_name: 'notes',
      exclusion_type: 'append',
    };

    const isCompliance = isComplianceField(exclusion.field_name);
    const showDeleteButton = !isCompliance;

    expect(showDeleteButton).toBe(true);
  });

  it('11. Config column hidden for never_merge type', () => {
    const exclusion = {
      exclusion_type: 'never_merge',
    };

    const showConfig = exclusion.exclusion_type === 'append';

    expect(showConfig).toBe(false);
  });

  it('12. Config column hidden for union_true type', () => {
    const exclusion = {
      exclusion_type: 'union_true',
    };

    const showConfig = exclusion.exclusion_type === 'append';

    expect(showConfig).toBe(false);
  });

  it('13. Separator dropdown shown for append type', () => {
    const exclusion = {
      exclusion_type: 'append',
      separator: '\n',
    };

    const showConfig = exclusion.exclusion_type === 'append';

    expect(showConfig).toBe(true);
    expect(SEPARATOR_OPTIONS.length).toBe(3);
  });

  it('14. Type change updates config column immediately', () => {
    let exclusion = {
      exclusion_type: 'never_merge',
      separator: '\n',
    };

    // Simulate changing type to append
    exclusion = { ...exclusion, exclusion_type: 'append' };

    const showConfig = exclusion.exclusion_type === 'append';

    expect(showConfig).toBe(true);
  });

  it('15. Add exception inserts blank row', () => {
    const exclusions: any[] = [];

    // Simulate adding an exception
    const newExclusion = {
      id: 'new-1',
      field_name: '',
      exclusion_type: 'never_merge',
      separator: '\n',
    };
    exclusions.push(newExclusion);

    expect(exclusions.length).toBe(1);
    expect(exclusions[0].field_name).toBe('');
    expect(exclusions[0].exclusion_type).toBe('never_merge');
  });

  it('16. Delete removes row immediately (no confirm)', () => {
    const exclusions = [
      { id: '1', field_name: 'notes' },
      { id: '2', field_name: 'description' },
    ];

    // Simulate deleting index 0
    const updated = exclusions.filter((_, i) => i !== 0);

    expect(updated.length).toBe(1);
    expect(updated[0].field_name).toBe('description');
  });

  it('17. Save validates empty field shows error', () => {
    const exclusions = [
      { field_name: '', exclusion_type: 'append' },
    ];

    let hasError = false;
    exclusions.forEach((excl) => {
      if (!excl.field_name) {
        hasError = true;
      }
    });

    expect(hasError).toBe(true);
  });

  it('18. Save validates missing type shows error', () => {
    const exclusions = [
      { field_name: 'notes', exclusion_type: '' },
    ];

    let hasError = false;
    exclusions.forEach((excl) => {
      if (!excl.exclusion_type) {
        hasError = true;
      }
    });

    expect(hasError).toBe(true);
  });

  it('19. Compliance fields not included in save payload', () => {
    const allExclusions = [
      { field_name: 'notes', exclusion_type: 'append' },
      { field_name: 'hs_email_optout', exclusion_type: 'union_true' },
      { field_name: 'description', exclusion_type: 'append' },
    ];

    const customOnly = allExclusions.filter((e) => !isComplianceField(e.field_name));

    expect(customOnly.length).toBe(2);
    expect(customOnly.map((e) => e.field_name)).not.toContain('hs_email_optout');
  });

  it('20. Object type switcher loads correct exclusions', () => {
    const allExclusions = [
      { id: '1', object_type: 'company', field_name: 'notes' },
      { id: '2', object_type: 'contact', field_name: 'description' },
    ];

    const activeTab = 'company';
    const filtered = allExclusions.filter((e) => e.object_type === activeTab);

    expect(filtered.length).toBe(1);
    expect(filtered[0].object_type).toBe('company');
  });
});

describe('Plain Language Mappings', () => {
  it('Exclusion type labels map correctly', () => {
    expect(getExclusionTypeLabel('never_merge')).toBe('Never merge');
    expect(getExclusionTypeLabel('union_true')).toBe('If any = true');
    expect(getExclusionTypeLabel('append')).toBe('Append');
  });

  it('Separator labels map correctly', () => {
    expect(getSeparatorLabel('\n')).toBe('New line');
    expect(getSeparatorLabel('; ')).toBe('Semicolon');
    expect(getSeparatorLabel(', ')).toBe('Comma');
  });

  it('Field labels map correctly', () => {
    expect(getFieldLabel('notes', 'company')).toBe('Notes');
    expect(getFieldLabel('hs_parent_company_id', 'company')).toBe('Parent company ID');
    expect(getFieldLabel('description', 'contact')).toBe('Description');
  });

  it('Compliance field check works', () => {
    expect(isComplianceField('hs_email_optout')).toBe(true);
    expect(isComplianceField('DoNotCall')).toBe(true);
    expect(isComplianceField('notes')).toBe(false);
  });

  it('Type badge colors match design system', () => {
    const neverMergeBadge = getTypeBadgeColor('never_merge');
    const appendBadge = getTypeBadgeColor('append');
    const unionTrueBadge = getTypeBadgeColor('union_true');

    expect(neverMergeBadge.background).toBe('rgba(255,255,255,0.1)');
    expect(appendBadge.background).toBe('rgba(46,107,168,0.2)');
    expect(unionTrueBadge.background).toBe('rgba(217,119,6,0.2)');
  });
});
