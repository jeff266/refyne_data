#!/usr/bin/env tsx
/**
 * Verify Harmony Bundle
 *
 * This script verifies that the harmony bundle is properly generated
 * and all YAML files are accessible without filesystem access.
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';

const projectRoot = join(process.cwd());
const bundlePath = join(projectRoot, 'lib/harmonies/library/generated-bundle.ts');

console.log('🔍 Verifying Harmony Bundle...\n');

// Check if bundle exists
if (!existsSync(bundlePath)) {
  console.error('❌ Bundle file not found:', bundlePath);
  console.error('   Run: npm run generate:harmonies');
  process.exit(1);
}

console.log('✓ Bundle file exists');

// Check bundle size
const stats = statSync(bundlePath);
const sizeKB = Math.round(stats.size / 1024);
console.log(`✓ Bundle size: ${sizeKB}KB`);

// Load the bundle
try {
  const bundle = require('../lib/harmonies/library/generated-bundle');

  const fileCount = bundle.HARMONY_YAML_FILES.length;
  const bundleKeys = Object.keys(bundle.HARMONY_YAML_BUNDLE);

  console.log(`✓ Bundle exports ${fileCount} files`);
  console.log(`✓ Bundle contains ${bundleKeys.length} YAML entries`);

  // Verify all files are in the bundle
  if (fileCount !== bundleKeys.length) {
    console.error(
      '❌ Mismatch between HARMONY_YAML_FILES and HARMONY_YAML_BUNDLE'
    );
    process.exit(1);
  }

  // Check a sample file
  const sampleFile = bundle.HARMONY_YAML_FILES[0];
  const sampleContent = bundle.HARMONY_YAML_BUNDLE[sampleFile];

  if (!sampleContent || sampleContent.length === 0) {
    console.error(`❌ Sample file ${sampleFile} has no content`);
    process.exit(1);
  }

  console.log(`✓ Sample file (${sampleFile}): ${sampleContent.length} chars`);

  // Try loading through the library
  const { getLibraryHarmonies } = require('../lib/harmonies/library');
  const harmonies = getLibraryHarmonies();

  console.log(`✓ Library loaded ${harmonies.length} harmonies`);

  // Verify count matches
  if (harmonies.length !== fileCount) {
    console.warn(
      `⚠️  Warning: Expected ${fileCount} harmonies but got ${harmonies.length}`
    );
    console.warn('   Some YAML files may have parse errors');
  }

  console.log('\n✅ Harmony bundle verification passed!');
  console.log('\nBundled harmonies:');
  harmonies.forEach((h) => {
    console.log(`  - ${h.spec.id}: ${h.spec.name}`);
  });
} catch (err) {
  console.error('❌ Failed to load bundle:', err);
  process.exit(1);
}
