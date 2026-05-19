/**
 * Tests for the Harmony Library - Phase 7
 *
 * Tests that:
 * 1. All YAML files parse without errors
 * 2. All embedded test cases pass
 * 3. Suffix normalization works correctly (Option C)
 * 4. Library lookup functions work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseHarmony } from '../spec/parser';
import { runHarmonyTests, formatTestResults } from '../engine/test-runner';
import {
  loadLibraryHarmonies,
  getHarmonyById,
  getHarmoniesForField,
  getHarmoniesByCategory,
  getLibrarySummary,
  clearLibraryCache,
  LIBRARY_HARMONIES,
  ensureInitialized,
} from './index';
import type { ValidatedHarmony } from '../spec/schema';

// Path to the library directory
const LIBRARY_DIR = __dirname;

// List of expected YAML files
const EXPECTED_YAML_FILES = [
  'company-name.yaml',
  'company-domain.yaml',
  'company-revenue.yaml',
  'company-employees.yaml',
  'company-industry.yaml',
  'person-name.yaml',
  'person-title.yaml',
  'phone.yaml',
  'email.yaml',
  'address-country.yaml',
  'address-state.yaml',
  'linkedin-url.yaml',
  'contact-name-case.yaml',
  'contact-phone-e164.yaml',
  'contact-title-standard.yaml',
  'contact-email-lower.yaml',
  'contact-location.yaml',
];

describe('Harmony Library', () => {
  beforeAll(() => {
    clearLibraryCache();
  });

  afterAll(() => {
    clearLibraryCache();
  });

  describe('YAML File Parsing', () => {
    it('should have all expected YAML files', () => {
      const files = readdirSync(LIBRARY_DIR).filter((f) => f.endsWith('.yaml'));
      expect(files.sort()).toEqual(EXPECTED_YAML_FILES.sort());
    });

    it.each(EXPECTED_YAML_FILES)('should parse %s without errors', (filename) => {
      const filepath = join(LIBRARY_DIR, filename);
      const content = readFileSync(filepath, 'utf-8');
      const result = parseHarmony(content, { source: 'library' });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.harmony).toBeDefined();
      expect(result.harmony?.spec.id).toBeTruthy();
      expect(result.harmony?.spec.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should load all library Harmonies successfully', () => {
      const harmonies = loadLibraryHarmonies(true);
      expect(harmonies.length).toBe(EXPECTED_YAML_FILES.length);
    });
  });

  describe('Embedded Test Cases', () => {
    let harmonies: ValidatedHarmony[];

    beforeAll(() => {
      harmonies = loadLibraryHarmonies(true);
    });

    it.each(EXPECTED_YAML_FILES.map((f) => f.replace('.yaml', '')))(
      'should pass all tests for %s',
      async (harmonyId) => {
        const harmony = harmonies.find((h) => h.spec.id === harmonyId);
        expect(harmony).toBeDefined();

        if (harmony) {
          const results = await runHarmonyTests(harmony);

          if (!results.allPassed) {
            console.log(formatTestResults(results));
          }

          expect(results.allPassed).toBe(true);
          expect(results.failed).toBe(0);
        }
      }
    );
  });

  describe('Company Name Suffix Normalization (Option C)', () => {
    let companyNameHarmony: ValidatedHarmony | undefined;

    beforeAll(() => {
      ensureInitialized();
      companyNameHarmony = getHarmonyById('company-name');
    });

    it('should have the company-name harmony loaded', () => {
      expect(companyNameHarmony).toBeDefined();
    });

    it('should normalize "ACME CORPORATION" to "Acme Corp." (not strip suffix)', async () => {
      if (!companyNameHarmony) return;

      const results = await runHarmonyTests(companyNameHarmony);
      const testCase = results.results.find(
        (r) => r.name === 'Normalizes Corporation to Corp.'
      );

      expect(testCase).toBeDefined();
      expect(testCase?.passed).toBe(true);
      expect(testCase?.expected).toBe('Acme Corp.');
    });

    it('should normalize "TechStart Incorporated" to "Techstart Inc."', async () => {
      if (!companyNameHarmony) return;

      const results = await runHarmonyTests(companyNameHarmony);
      const testCase = results.results.find(
        (r) => r.name === 'Normalizes Incorporated to Inc.'
      );

      expect(testCase).toBeDefined();
      expect(testCase?.passed).toBe(true);
    });

    it('should keep LLC suffix normalized', async () => {
      if (!companyNameHarmony) return;

      const results = await runHarmonyTests(companyNameHarmony);
      const testCase = results.results.find(
        (r) => r.name === 'Keeps LLC suffix normalized'
      );

      expect(testCase).toBeDefined();
      expect(testCase?.passed).toBe(true);
    });

    it('should normalize Limited to Ltd.', async () => {
      if (!companyNameHarmony) return;

      const results = await runHarmonyTests(companyNameHarmony);
      const testCase = results.results.find(
        (r) => r.name === 'Normalizes Limited to Ltd.'
      );

      expect(testCase).toBeDefined();
      expect(testCase?.passed).toBe(true);
    });

    it('should keep GmbH as-is (German form)', async () => {
      if (!companyNameHarmony) return;

      const results = await runHarmonyTests(companyNameHarmony);
      const testCase = results.results.find((r) => r.name === 'Keeps GmbH as-is');

      expect(testCase).toBeDefined();
      expect(testCase?.passed).toBe(true);
    });

    it('should normalize international forms (B.V., N.V., S.A., etc.)', async () => {
      if (!companyNameHarmony) return;

      const results = await runHarmonyTests(companyNameHarmony);

      const saTest = results.results.find((r) => r.name === 'Normalizes S.A. format');
      const bvTest = results.results.find((r) => r.name === 'Normalizes B.V. format');
      const ptyLtdTest = results.results.find(
        (r) => r.name === 'Normalizes Pty Ltd format'
      );

      expect(saTest?.passed).toBe(true);
      expect(bvTest?.passed).toBe(true);
      expect(ptyLtdTest?.passed).toBe(true);
    });
  });

  describe('Library Lookup Functions', () => {
    beforeAll(() => {
      ensureInitialized();
    });

    it('should get harmony by ID', () => {
      const harmony = getHarmonyById('company-domain');
      expect(harmony).toBeDefined();
      expect(harmony?.spec.id).toBe('company-domain');
    });

    it('should return undefined for unknown ID', () => {
      const harmony = getHarmonyById('nonexistent-harmony');
      expect(harmony).toBeUndefined();
    });

    it('should get harmonies for company.name field', () => {
      const harmonies = getHarmoniesForField('company.name');
      expect(harmonies.length).toBeGreaterThan(0);
      expect(harmonies.some((h) => h.spec.id === 'company-name')).toBe(true);
    });

    it('should get harmonies for person.email field', () => {
      const harmonies = getHarmoniesForField('person.email');
      expect(harmonies.length).toBeGreaterThan(0);
      expect(harmonies.some((h) => h.spec.id === 'email')).toBe(true);
    });

    it('should return empty array for unknown field', () => {
      const harmonies = getHarmoniesForField('unknown.field');
      expect(harmonies).toHaveLength(0);
    });

    it('should get harmonies by category', () => {
      const businessEntities = getHarmoniesByCategory('business-entities');
      expect(businessEntities.length).toBeGreaterThan(0);

      const geography = getHarmoniesByCategory('geography');
      expect(geography.length).toBeGreaterThan(0);
    });

    it('should provide library summary', () => {
      const summary = getLibrarySummary();

      expect(summary.total).toBe(EXPECTED_YAML_FILES.length);
      expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0);
      expect(summary.harmonies.length).toBe(EXPECTED_YAML_FILES.length);
    });

    it('should populate LIBRARY_HARMONIES constant', () => {
      ensureInitialized();
      expect(LIBRARY_HARMONIES.length).toBe(EXPECTED_YAML_FILES.length);
    });
  });

  describe('Individual Harmony Validations', () => {
    beforeAll(() => {
      ensureInitialized();
    });

    it('company-domain should extract domain correctly', async () => {
      const harmony = getHarmonyById('company-domain');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('company-revenue should parse various formats', async () => {
      const harmony = getHarmonyById('company-revenue');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('company-employees should parse ranges and approximations', async () => {
      const harmony = getHarmonyById('company-employees');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('company-industry should map to canonical taxonomy', async () => {
      const harmony = getHarmonyById('company-industry');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('person-name should handle various name formats', async () => {
      const harmony = getHarmonyById('person-name');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('person-title should normalize and categorize titles', async () => {
      const harmony = getHarmonyById('person-title');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('phone should format US numbers correctly', async () => {
      const harmony = getHarmonyById('phone');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('email should normalize and validate emails', async () => {
      const harmony = getHarmonyById('email');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('address-country should map country variations', async () => {
      const harmony = getHarmonyById('address-country');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('address-state should map US state variations', async () => {
      const harmony = getHarmonyById('address-state');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });

    it('linkedin-url should normalize LinkedIn URLs', async () => {
      const harmony = getHarmonyById('linkedin-url');
      expect(harmony).toBeDefined();

      if (harmony) {
        const results = await runHarmonyTests(harmony);
        expect(results.allPassed).toBe(true);
      }
    });
  });

  describe('Schema Validation', () => {
    let harmonies: ValidatedHarmony[];

    beforeAll(() => {
      harmonies = loadLibraryHarmonies(true);
    });

    it('all harmonies should have valid IDs', () => {
      for (const harmony of harmonies) {
        expect(harmony.spec.id).toMatch(/^[a-z0-9-]+$/);
      }
    });

    it('all harmonies should have valid semver versions', () => {
      for (const harmony of harmonies) {
        expect(harmony.spec.version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    });

    it('all harmonies should have at least 3 test cases', () => {
      for (const harmony of harmonies) {
        expect(harmony.spec.tests.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('all harmonies should have author set', () => {
      for (const harmony of harmonies) {
        expect(harmony.spec.author).toBeTruthy();
      }
    });

    it('all harmonies should have valid categories', () => {
      const validCategories = [
        'business-entities',
        'geography',
        'industry',
        'contact-fields',
        'firmographics',
        'social',
        'custom',
      ];

      for (const harmony of harmonies) {
        expect(validCategories).toContain(harmony.spec.category);
      }
    });

    it('all harmonies should have at least one rule', () => {
      for (const harmony of harmonies) {
        expect(harmony.spec.rules.length).toBeGreaterThan(0);
      }
    });

    it('all rules should have valid IDs', () => {
      for (const harmony of harmonies) {
        for (const rule of harmony.spec.rules) {
          expect(rule.id).toMatch(/^[a-z0-9-]+$/);
        }
      }
    });
  });
});
