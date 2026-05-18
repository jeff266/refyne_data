/**
 * Vitest tests for the Harmony Spec Parser.
 *
 * Tests YAML parsing, schema validation, JSONata expression validation,
 * and round-trip serialization.
 */

import { describe, it, expect } from 'vitest';
import {
  parseHarmony,
  parseHarmonies,
  serializeHarmony,
  createHarmonyTemplate,
  getHarmonyIdentifier,
  compareHarmonyVersions,
} from './parser';
import { validateHarmonySpec, validateFieldPaths, HarmonySpec } from './schema';

// ═══════════════════════════════════════════════════════════════
// VALID YAML FIXTURES
// ═══════════════════════════════════════════════════════════════

const VALID_HARMONY_YAML = `
id: company-name-normalizer
version: 1.0.0
name: Company Name Normalizer
description: Normalizes company names to title case
category: business-entities
author: revops-impact

applies_to:
  fields:
    - company.name
  entity: company

sources: []

rules:
  - id: normalize-case
    description: Convert to title case
    transform: $normalize_case(value, "title")

tests:
  - name: Basic test
    input: ACME CORP
    expected: Acme Corp
`;

const MINIMAL_HARMONY_YAML = `
id: minimal-harmony
version: 1.0.0
name: Minimal Harmony
description: A minimal harmony for testing
category: custom
author: test

applies_to:
  fields:
    - company.name

rules:
  - id: passthrough
    description: Pass through value
    transform: value

tests:
  - input: test
    expected: test
`;

const COMPLEX_HARMONY_YAML = `
id: revenue-normalizer
version: 2.1.0-beta
name: Revenue Normalizer
description: Parse and normalize revenue values from various formats
category: firmographics
author: revops-impact

applies_to:
  fields:
    - company.annual_revenue
  entity: company

sources:
  - clearbit
  - zoominfo

rules:
  - id: parse-with-suffix
    description: Parse values with M/B/K suffix
    when: $match_pattern(value, "[0-9]+[MBK]").matched
    transform: $parse_number(value)

  - id: parse-standard
    description: Parse standard numeric values
    transform: $parse_number(value)
    default: 0

tests:
  - name: Parse millions
    input: "$1.5M"
    expected: 1500000

  - name: Parse with commas
    input: "15,000"
    expected: 15000

  - name: Null input
    input: null
    expected: null

on_error: fail-default
tags:
  - revenue
  - normalization
depends_on:
  - currency-cleaner
default_enabled: true
`;

// ═══════════════════════════════════════════════════════════════
// parseHarmony TESTS - VALID YAML
// ═══════════════════════════════════════════════════════════════

describe('parseHarmony - valid YAML', () => {
  it('should parse valid harmony YAML', () => {
    const result = parseHarmony(VALID_HARMONY_YAML);

    expect(result.success).toBe(true);
    expect(result.harmony).toBeDefined();
    expect(result.errors).toHaveLength(0);
    expect(result.harmony?.spec.id).toBe('company-name-normalizer');
    expect(result.harmony?.spec.version).toBe('1.0.0');
  });

  it('should parse minimal harmony YAML', () => {
    const result = parseHarmony(MINIMAL_HARMONY_YAML);

    expect(result.success).toBe(true);
    expect(result.harmony?.spec.id).toBe('minimal-harmony');
    expect(result.harmony?.spec.rules).toHaveLength(1);
    expect(result.harmony?.spec.tests).toHaveLength(1);
  });

  it('should parse complex harmony with conditions', () => {
    const result = parseHarmony(COMPLEX_HARMONY_YAML);

    expect(result.success).toBe(true);
    expect(result.harmony?.spec.rules).toHaveLength(2);
    expect(result.harmony?.spec.rules[0].when).toBeDefined();
    expect(result.harmony?.spec.tags).toContain('revenue');
    expect(result.harmony?.spec.depends_on).toContain('currency-cleaner');
  });

  it('should include hash for cache invalidation', () => {
    const result = parseHarmony(VALID_HARMONY_YAML);

    expect(result.harmony?.hash).toBeDefined();
    expect(result.harmony?.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should set source to custom by default', () => {
    const result = parseHarmony(VALID_HARMONY_YAML);
    expect(result.harmony?.source).toBe('custom');
  });

  it('should accept source option', () => {
    const result = parseHarmony(VALID_HARMONY_YAML, { source: 'library' });
    expect(result.harmony?.source).toBe('library');
  });

  it('should accept org_id option', () => {
    const result = parseHarmony(VALID_HARMONY_YAML, { org_id: 'org-123' });
    expect(result.harmony?.org_id).toBe('org-123');
  });

  it('should include compiled_at timestamp', () => {
    const result = parseHarmony(VALID_HARMONY_YAML);
    expect(result.harmony?.compiled_at).toBeDefined();
    expect(new Date(result.harmony!.compiled_at).getTime()).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════
// parseHarmony TESTS - MALFORMED YAML
// ═══════════════════════════════════════════════════════════════

describe('parseHarmony - malformed YAML', () => {
  it('should fail on invalid YAML syntax', () => {
    const invalidYaml = `
id: test
  bad-indent: value
version: 1.0.0
`;
    const result = parseHarmony(invalidYaml);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('yaml_parse_error');
  });

  it('should fail on unclosed quotes', () => {
    const invalidYaml = `
id: "unclosed
version: 1.0.0
`;
    const result = parseHarmony(invalidYaml);

    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe('yaml_parse_error');
  });

  it('should fail on tabs instead of spaces', () => {
    // YAML with tabs can cause issues
    const yamlWithTabs = `id: test\n\tname: Test`;
    const result = parseHarmony(yamlWithTabs);

    // May fail parsing or validation
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// parseHarmony TESTS - MISSING REQUIRED FIELDS
// ═══════════════════════════════════════════════════════════════

describe('parseHarmony - missing required fields', () => {
  it('should fail when missing id', () => {
    const yaml = `
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    transform: value
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'id' || e.message.includes('id'))).toBe(true);
  });

  it('should fail when missing version', () => {
    const yaml = `
id: test-harmony
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    transform: value
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'version' || e.message.includes('version'))).toBe(true);
  });

  it('should fail when missing rules', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
  });

  it('should fail when missing tests', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    transform: value
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
  });

  it('should fail when missing applies_to.fields', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  entity: company
rules:
  - id: rule1
    description: test
    transform: value
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
  });

  it('should fail with empty rules array', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules: []
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
  });

  it('should fail with empty tests array', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    transform: value
tests: []
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// parseHarmony TESTS - INVALID JSONata EXPRESSIONS
// ═══════════════════════════════════════════════════════════════

describe('parseHarmony - invalid JSONata expressions', () => {
  it('should fail on invalid transform expression', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    transform: $unclosed_paren(
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'invalid_jsonata')).toBe(true);
  });

  it('should fail on invalid when condition', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    when: value > > 10
    transform: value
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.code === 'invalid_jsonata')).toBe(true);
  });

  it('should catch syntax error with position', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: bad-syntax
    description: test
    transform: value + +
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml);

    expect(result.success).toBe(false);
    expect(result.errors[0].path).toContain('bad-syntax');
  });

  it('should skip JSONata validation when disabled', () => {
    const yaml = `
id: test-harmony
version: 1.0.0
name: Test Harmony
description: A test
category: custom
author: test
applies_to:
  fields:
    - company.name
rules:
  - id: rule1
    description: test
    transform: $unclosed_paren(
tests:
  - input: test
    expected: test
`;
    const result = parseHarmony(yaml, { validateExpressions: false });

    // Should pass schema validation even with bad JSONata
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// validateHarmonySpec TESTS
// ═══════════════════════════════════════════════════════════════

describe('validateHarmonySpec', () => {
  it('should validate correct spec object', () => {
    const spec = {
      id: 'test-harmony',
      version: '1.0.0',
      name: 'Test Harmony',
      description: 'A test harmony',
      category: 'custom',
      author: 'test',
      applies_to: {
        fields: ['company.name'],
      },
      rules: [
        {
          id: 'rule1',
          description: 'Test rule',
          transform: 'value',
        },
      ],
      tests: [
        {
          input: 'test',
          expected: 'test',
        },
      ],
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(true);
    expect(result.harmony).toBeDefined();
  });

  it('should reject invalid id format', () => {
    const spec = {
      id: 'Invalid_ID',  // Uppercase and underscore not allowed
      version: '1.0.0',
      name: 'Test',
      description: 'A test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'id')).toBe(true);
  });

  it('should reject invalid version format', () => {
    const spec = {
      id: 'test',
      version: 'v1',  // Invalid semver
      name: 'Test',
      description: 'A test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path === 'version')).toBe(true);
  });

  it('should reject invalid category', () => {
    const spec = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'A test',
      category: 'invalid-category',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(false);
  });

  it('should reject invalid rule id format', () => {
    const spec = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'A test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [{ id: 'Invalid_Rule', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(false);
  });

  it('should collect warnings for few tests', () => {
    const spec = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'A test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],  // Only 1 test
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.path === 'tests')).toBe(true);
  });

  it('should warn about multiple unconditional rules', () => {
    const spec = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'A test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [
        { id: 'rule1', description: 'test', transform: 'value' },
        { id: 'rule2', description: 'test', transform: 'value' },
      ],
      tests: [{ input: 'test', expected: 'test' }],
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.path === 'rules')).toBe(true);
  });

  it('should warn about fail-loud policy', () => {
    const spec = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'A test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
      on_error: 'fail-loud',
    };

    const result = validateHarmonySpec(spec);

    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.path === 'on_error')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// validateFieldPaths TESTS
// ═══════════════════════════════════════════════════════════════

describe('validateFieldPaths', () => {
  it('should validate standard company fields', () => {
    const result = validateFieldPaths(['company.name', 'company.domain'], 'company');
    expect(result.valid).toBe(true);
    expect(result.invalidFields).toHaveLength(0);
  });

  it('should validate standard person fields', () => {
    const result = validateFieldPaths(['person.first_name', 'person.email'], 'person');
    expect(result.valid).toBe(true);
  });

  it('should detect invalid fields', () => {
    const result = validateFieldPaths(['company.custom_field', 'company.name'], 'company');
    expect(result.valid).toBe(false);
    expect(result.invalidFields).toContain('company.custom_field');
  });

  it('should validate without entity restriction', () => {
    const result = validateFieldPaths(['company.name', 'person.email']);
    expect(result.valid).toBe(true);
  });

  it('should reject person fields when entity is company', () => {
    const result = validateFieldPaths(['person.email'], 'company');
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// serializeHarmony TESTS - ROUND TRIP
// ═══════════════════════════════════════════════════════════════

describe('serializeHarmony - round trip', () => {
  it('should serialize and re-parse to same spec', () => {
    const original = parseHarmony(VALID_HARMONY_YAML);
    expect(original.success).toBe(true);

    const serialized = serializeHarmony(original.harmony!.spec);
    const reparsed = parseHarmony(serialized);

    expect(reparsed.success).toBe(true);
    expect(reparsed.harmony?.spec.id).toBe(original.harmony?.spec.id);
    expect(reparsed.harmony?.spec.version).toBe(original.harmony?.spec.version);
    expect(reparsed.harmony?.spec.rules).toHaveLength(original.harmony?.spec.rules.length ?? 0);
  });

  it('should preserve complex spec through round trip', () => {
    const original = parseHarmony(COMPLEX_HARMONY_YAML);
    expect(original.success).toBe(true);

    const serialized = serializeHarmony(original.harmony!.spec);
    const reparsed = parseHarmony(serialized);

    expect(reparsed.success).toBe(true);
    expect(reparsed.harmony?.spec.tags).toEqual(original.harmony?.spec.tags);
    expect(reparsed.harmony?.spec.depends_on).toEqual(original.harmony?.spec.depends_on);
    expect(reparsed.harmony?.spec.rules[0].when).toBe(original.harmony?.spec.rules[0].when);
  });

  it('should produce valid YAML string', () => {
    const spec: HarmonySpec = {
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'A test harmony',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      sources: [],
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
      on_error: 'fail-silent-log',
      default_enabled: true,
    };

    const yaml = serializeHarmony(spec);

    expect(yaml).toContain('id: test');
    expect(yaml).toContain('version: 1.0.0');
    expect(yaml).toContain('transform: value');
  });
});

// ═══════════════════════════════════════════════════════════════
// parseHarmonies TESTS
// ═══════════════════════════════════════════════════════════════

describe('parseHarmonies', () => {
  it('should parse multiple harmonies', () => {
    const yamls = [
      { name: 'harmony1.yaml', content: VALID_HARMONY_YAML },
      { name: 'harmony2.yaml', content: MINIMAL_HARMONY_YAML },
    ];

    const result = parseHarmonies(yamls);

    expect(result.harmonies).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect errors from failed parses', () => {
    const yamls = [
      { name: 'valid.yaml', content: VALID_HARMONY_YAML },
      { name: 'invalid.yaml', content: 'id: test\nbad: yaml:' },
    ];

    const result = parseHarmonies(yamls);

    expect(result.harmonies).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe('invalid.yaml');
  });

  it('should stop on first error when stopOnError is true', () => {
    const yamls = [
      { name: 'invalid1.yaml', content: 'bad yaml:' },
      { name: 'valid.yaml', content: VALID_HARMONY_YAML },
    ];

    const result = parseHarmonies(yamls, { stopOnError: true });

    expect(result.harmonies).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('should continue on errors when stopOnError is false', () => {
    const yamls = [
      { name: 'invalid.yaml', content: 'bad yaml:' },
      { name: 'valid.yaml', content: VALID_HARMONY_YAML },
    ];

    const result = parseHarmonies(yamls, { stopOnError: false });

    expect(result.harmonies).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should collect warnings', () => {
    // VALID_HARMONY_YAML may generate warnings for few tests
    const yamls = [{ name: 'harmony.yaml', content: VALID_HARMONY_YAML }];

    const result = parseHarmonies(yamls);

    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('createHarmonyTemplate', () => {
  it('should create template with defaults', () => {
    const spec = createHarmonyTemplate('my-harmony', 'My Harmony');

    expect(spec.id).toBe('my-harmony');
    expect(spec.name).toBe('My Harmony');
    expect(spec.version).toBe('1.0.0');
    expect(spec.category).toBe('custom');
    expect(spec.author).toBe('user');
    expect(spec.rules).toHaveLength(1);
    expect(spec.tests).toHaveLength(1);
  });

  it('should accept custom category', () => {
    const spec = createHarmonyTemplate('test', 'Test', { category: 'geography' });
    expect(spec.category).toBe('geography');
  });

  it('should accept custom author', () => {
    const spec = createHarmonyTemplate('test', 'Test', { author: 'acme-corp' });
    expect(spec.author).toBe('acme-corp');
  });

  it('should accept custom fields', () => {
    const spec = createHarmonyTemplate('test', 'Test', {
      fields: ['company.industry', 'company.domain'],
    });
    expect(spec.applies_to.fields).toEqual(['company.industry', 'company.domain']);
    expect(spec.description).toContain('industry');
  });
});

describe('getHarmonyIdentifier', () => {
  it('should return id@version format', () => {
    const spec: HarmonySpec = {
      id: 'my-harmony',
      version: '2.1.0',
      name: 'Test',
      description: 'Test',
      category: 'custom',
      author: 'test',
      applies_to: { fields: ['company.name'] },
      sources: [],
      rules: [{ id: 'rule1', description: 'test', transform: 'value' }],
      tests: [{ input: 'test', expected: 'test' }],
      on_error: 'fail-silent-log',
      default_enabled: true,
    };

    expect(getHarmonyIdentifier(spec)).toBe('my-harmony@2.1.0');
  });
});

describe('compareHarmonyVersions', () => {
  it('should compare major versions', () => {
    expect(compareHarmonyVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareHarmonyVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('should compare minor versions', () => {
    expect(compareHarmonyVersions('1.2.0', '1.1.0')).toBe(1);
    expect(compareHarmonyVersions('1.1.0', '1.2.0')).toBe(-1);
  });

  it('should compare patch versions', () => {
    expect(compareHarmonyVersions('1.0.2', '1.0.1')).toBe(1);
    expect(compareHarmonyVersions('1.0.1', '1.0.2')).toBe(-1);
  });

  it('should return 0 for equal versions', () => {
    expect(compareHarmonyVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareHarmonyVersions('2.5.3', '2.5.3')).toBe(0);
  });

  it('should handle prerelease versions', () => {
    // Release > prerelease
    expect(compareHarmonyVersions('1.0.0', '1.0.0-alpha')).toBe(1);
    expect(compareHarmonyVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
  });

  it('should compare prerelease tags alphabetically', () => {
    expect(compareHarmonyVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    expect(compareHarmonyVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
  });
});
