#!/usr/bin/env npx tsx
/**
 * Add Sentry error tracking to all API routes.
 *
 * This script:
 * 1. Adds import for captureWithOrgContext at the top of each route file
 * 2. Wraps catch blocks that use console.error with captureWithOrgContext
 * 3. Keeps the existing console.error statements
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { resolve } from 'path';

const stats = {
  filesUpdated: 0,
  catchBlocksInstrumented: 0,
  filesSkipped: 0,
};

function hasOrgContext(content: string): boolean {
  return content.includes('getOrgContext') || content.includes('requireAdmin');
}

function extractOrgIdVar(content: string): string {
  if (content.includes('ctx.orgId')) return 'ctx.orgId';
  if (content.match(/const\s+orgId\s*=/)) return 'orgId';
  return 'ctx.orgId';
}

function getRouteName(filePath: string): string {
  const match = filePath.match(/app\/api\/(.+)\/route\.ts/);
  if (match) {
    return `/api/${match[1]}`;
  }
  return filePath;
}

function addSentryImport(content: string): string {
  if (content.includes('captureWithOrgContext')) {
    return content;
  }

  // Find where to insert the import (after other imports)
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^import\s/)) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(
      lastImportIndex + 1,
      0,
      "import { captureWithOrgContext } from '@/lib/monitoring/sentry';"
    );
    return lines.join('\n');
  }

  return content;
}

function instrumentCatchBlocks(
  content: string,
  filePath: string
): [string, number] {
  let count = 0;

  if (!hasOrgContext(content)) {
    return [content, count];
  }

  const orgIdVar = extractOrgIdVar(content);
  const routeName = getRouteName(filePath);

  const lines = content.split('\n');
  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for console.error patterns we want to instrument
    if (
      (line.includes("console.error('Failed to") ||
        line.includes('console.error("[') ||
        line.includes('console.error("Failed to')) &&
      !lines.slice(Math.max(0, i - 5), i).some(l => l.includes('captureWithOrgContext'))
    ) {
      // Get the indentation of the console.error line
      const match = line.match(/^(\s*)/);
      const indent = match ? match[1] : '    ';

      // Add captureWithOrgContext before console.error
      newLines.push(
        `${indent}captureWithOrgContext(error, ${orgIdVar}, { route: '${routeName}' });`
      );
      count++;
    }

    newLines.push(line);
  }

  return [newLines.join('\n'), count];
}

function processFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8');

  if (!hasOrgContext(content)) {
    stats.filesSkipped++;
    return;
  }

  // Add import
  let newContent = addSentryImport(content);

  // Instrument catch blocks
  const [finalContent, count] = instrumentCatchBlocks(newContent, filePath);

  if (count > 0) {
    writeFileSync(filePath, finalContent);
    stats.filesUpdated++;
    stats.catchBlocksInstrumented += count;
    console.log(`✓ Updated ${filePath}: ${count} catch blocks instrumented`);
  } else {
    stats.filesSkipped++;
  }
}

function main(): void {
  const cwd = process.cwd();
  const apiDir = resolve(cwd, 'app/api');

  // Find all route.ts files
  const routeFiles = globSync('**/route.ts', { cwd: apiDir, absolute: true });

  console.log(`Found ${routeFiles.length} route files`);
  console.log('Processing...\n');

  for (const file of routeFiles) {
    try {
      processFile(file);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Files updated: ${stats.filesUpdated}`);
  console.log(`  Catch blocks instrumented: ${stats.catchBlocksInstrumented}`);
  console.log(`  Files skipped: ${stats.filesSkipped}`);
  console.log('='.repeat(60));
}

main();
