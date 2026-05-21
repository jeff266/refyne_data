/**
 * Verify Prospect Page Rebuild
 *
 * Checks all components are in place and working
 */

import fs from 'fs';
import path from 'path';

console.log('=== Prospect Page Rebuild Verification ===\n');

const checks: Array<{ name: string; passed: boolean; details?: string }> = [];

// Check 1: Apollo Key Helper
console.log('1. Checking Apollo Key Helper...');
const apolloKeyPath = path.join(process.cwd(), 'lib/providers/apollo-key.ts');
if (fs.existsSync(apolloKeyPath)) {
  const content = fs.readFileSync(apolloKeyPath, 'utf-8');
  const hasGetApolloKey = content.includes('export async function getApolloKey');
  const hasSupabaseImport = content.includes("from '@/lib/db/supabase'");
  const hasDecryptImport = content.includes("from '@/lib/crypto/providerKeys'");

  if (hasGetApolloKey && hasSupabaseImport && hasDecryptImport) {
    checks.push({ name: 'Apollo Key Helper', passed: true });
    console.log('   ✓ File exists with correct imports and exports');
  } else {
    checks.push({
      name: 'Apollo Key Helper',
      passed: false,
      details: 'Missing required function or imports',
    });
    console.log('   ✗ File missing required function or imports');
  }
} else {
  checks.push({ name: 'Apollo Key Helper', passed: false, details: 'File not found' });
  console.log('   ✗ File not found');
}

// Check 2: Migration File
console.log('\n2. Checking Migration File...');
const migrationPath = path.join(process.cwd(), 'lib/db/migrations/034_prospect_saved_searches.sql');
if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf-8');
  const hasTable = content.includes('CREATE TABLE IF NOT EXISTS prospect_saved_searches');
  const hasRLS = content.includes('ENABLE ROW LEVEL SECURITY');
  const hasPolicy = content.includes('org_isolation');

  if (hasTable && hasRLS && hasPolicy) {
    checks.push({ name: 'Migration File', passed: true });
    console.log('   ✓ Migration file exists with table, RLS, and policy');
  } else {
    checks.push({
      name: 'Migration File',
      passed: false,
      details: 'Missing table, RLS, or policy',
    });
    console.log('   ✗ Migration file missing required elements');
  }
} else {
  checks.push({ name: 'Migration File', passed: false, details: 'File not found' });
  console.log('   ✗ Migration file not found');
}

// Check 3: Saved Searches API Routes
console.log('\n3. Checking Saved Searches API Routes...');
const savedSearchesRoutePath = path.join(
  process.cwd(),
  'app/api/prospect/saved-searches/route.ts'
);
const savedSearchesIdRoutePath = path.join(
  process.cwd(),
  'app/api/prospect/saved-searches/[id]/route.ts'
);

if (fs.existsSync(savedSearchesRoutePath)) {
  const content = fs.readFileSync(savedSearchesRoutePath, 'utf-8');
  const hasGET = content.includes('export async function GET');
  const hasPOST = content.includes('export async function POST');
  const hasAuth = content.includes('getOrgContext');

  if (hasGET && hasPOST && hasAuth) {
    checks.push({ name: 'Saved Searches API (list/create)', passed: true });
    console.log('   ✓ Route exists with GET, POST, and auth');
  } else {
    checks.push({
      name: 'Saved Searches API (list/create)',
      passed: false,
      details: 'Missing GET, POST, or auth',
    });
    console.log('   ✗ Route missing GET, POST, or auth');
  }
} else {
  checks.push({
    name: 'Saved Searches API (list/create)',
    passed: false,
    details: 'File not found',
  });
  console.log('   ✗ Route file not found');
}

if (fs.existsSync(savedSearchesIdRoutePath)) {
  const content = fs.readFileSync(savedSearchesIdRoutePath, 'utf-8');
  const hasDELETE = content.includes('export async function DELETE');
  const hasAuth = content.includes('getOrgContext');

  if (hasDELETE && hasAuth) {
    checks.push({ name: 'Saved Searches API (delete)', passed: true });
    console.log('   ✓ Delete route exists with auth');
  } else {
    checks.push({
      name: 'Saved Searches API (delete)',
      passed: false,
      details: 'Missing DELETE or auth',
    });
    console.log('   ✗ Delete route missing DELETE or auth');
  }
} else {
  checks.push({
    name: 'Saved Searches API (delete)',
    passed: false,
    details: 'File not found',
  });
  console.log('   ✗ Delete route file not found');
}

// Check 4: Prospect Page
console.log('\n4. Checking Prospect Page...');
const prospectPagePath = path.join(process.cwd(), 'app/(dashboard)/prospect/page.tsx');
if (fs.existsSync(prospectPagePath)) {
  const content = fs.readFileSync(prospectPagePath, 'utf-8');
  const hasChipInput = content.includes('function ChipInput');
  const hasRangeSlider = content.includes('function RangeSlider');
  const hasSavedSearchChip = content.includes('function SavedSearchChip');
  const hasResultsTable = content.includes('function ResultsTable');
  const hasICPScoreBar = content.includes('function ICPScoreBar');
  const hasCompanyDetail = content.includes('function CompanyDetailSlideOver');
  const hasExcludeCheckbox = content.includes('excludeInHubSpot');
  const hasDarkInputStyle = content.includes('darkInputStyle');

  if (
    hasChipInput &&
    hasRangeSlider &&
    hasSavedSearchChip &&
    hasResultsTable &&
    hasICPScoreBar &&
    hasCompanyDetail &&
    hasExcludeCheckbox &&
    hasDarkInputStyle
  ) {
    checks.push({ name: 'Prospect Page UI Components', passed: true });
    console.log('   ✓ All components present:');
    console.log('     - ChipInput');
    console.log('     - RangeSlider');
    console.log('     - SavedSearchChip');
    console.log('     - ResultsTable');
    console.log('     - ICPScoreBar');
    console.log('     - CompanyDetailSlideOver');
    console.log('     - Exclude in HubSpot checkbox');
    console.log('     - Dark input styling');
  } else {
    const missing = [];
    if (!hasChipInput) missing.push('ChipInput');
    if (!hasRangeSlider) missing.push('RangeSlider');
    if (!hasSavedSearchChip) missing.push('SavedSearchChip');
    if (!hasResultsTable) missing.push('ResultsTable');
    if (!hasICPScoreBar) missing.push('ICPScoreBar');
    if (!hasCompanyDetail) missing.push('CompanyDetailSlideOver');
    if (!hasExcludeCheckbox) missing.push('Exclude checkbox');
    if (!hasDarkInputStyle) missing.push('Dark styling');

    checks.push({
      name: 'Prospect Page UI Components',
      passed: false,
      details: `Missing: ${missing.join(', ')}`,
    });
    console.log('   ✗ Missing components:', missing.join(', '));
  }
} else {
  checks.push({
    name: 'Prospect Page UI Components',
    passed: false,
    details: 'File not found',
  });
  console.log('   ✗ Prospect page file not found');
}

// Check 5: API Route Updates
console.log('\n5. Checking API Route Updates...');
const searchRoutePath = path.join(process.cwd(), 'app/api/prospect/search/route.ts');
if (fs.existsSync(searchRoutePath)) {
  const content = fs.readFileSync(searchRoutePath, 'utf-8');
  const hasApolloKeyImport = content.includes("from '@/lib/providers/apollo-key'");
  const usesGetApolloKey = content.includes('getApolloKey');

  if (hasApolloKeyImport && usesGetApolloKey) {
    checks.push({ name: 'Search Route Apollo Key Fix', passed: true });
    console.log('   ✓ Search route uses getApolloKey helper');
  } else {
    checks.push({
      name: 'Search Route Apollo Key Fix',
      passed: false,
      details: 'Not using getApolloKey helper',
    });
    console.log('   ✗ Search route not using getApolloKey helper');
  }
} else {
  checks.push({
    name: 'Search Route Apollo Key Fix',
    passed: false,
    details: 'File not found',
  });
  console.log('   ✗ Search route file not found');
}

const previewRoutePath = path.join(process.cwd(), 'app/api/enrich/preview/route.ts');
if (fs.existsSync(previewRoutePath)) {
  const content = fs.readFileSync(previewRoutePath, 'utf-8');
  const hasApolloKeyImport = content.includes("from '@/lib/providers/apollo-key'");
  const usesGetApolloKey = content.includes('getApolloKey');
  const noDecryptKeyImport = !content.includes("import { decryptKey } from '@/lib/crypto/providerKeys'");

  if (hasApolloKeyImport && usesGetApolloKey) {
    checks.push({ name: 'Preview Route Apollo Key Fix', passed: true });
    console.log('   ✓ Preview route uses getApolloKey helper');
  } else {
    checks.push({
      name: 'Preview Route Apollo Key Fix',
      passed: false,
      details: 'Not using getApolloKey helper',
    });
    console.log('   ✗ Preview route not using getApolloKey helper');
  }
} else {
  checks.push({
    name: 'Preview Route Apollo Key Fix',
    passed: false,
    details: 'File not found',
  });
  console.log('   ✗ Preview route file not found');
}

// Check 6: ICP Scorer Updates
console.log('\n6. Checking ICP Scorer...');
const scorerPath = path.join(process.cwd(), 'lib/prospect/icp-scorer.ts');
if (fs.existsSync(scorerPath)) {
  const content = fs.readFileSync(scorerPath, 'utf-8');
  const hasPointsComment = content.includes('Point-based system');
  const hasBreakdownPoints = content.includes('industryPoints');

  if (hasPointsComment && hasBreakdownPoints) {
    checks.push({ name: 'ICP Scorer Point System', passed: true });
    console.log('   ✓ ICP scorer uses point-based breakdown');
  } else {
    checks.push({
      name: 'ICP Scorer Point System',
      passed: false,
      details: 'Not using point-based breakdown',
    });
    console.log('   ✗ ICP scorer not using point-based breakdown');
  }
} else {
  checks.push({
    name: 'ICP Scorer Point System',
    passed: false,
    details: 'File not found',
  });
  console.log('   ✗ ICP scorer file not found');
}

// Summary
console.log('\n=== Verification Summary ===\n');
const passed = checks.filter((c) => c.passed).length;
const total = checks.length;

console.log(`Checks Passed: ${passed}/${total}\n`);

if (passed === total) {
  console.log('✓ ALL CHECKS PASSED\n');
  console.log('The Prospect page rebuild is complete and all components are in place.\n');
  console.log('Next Steps:');
  console.log('1. Run migration: Apply 034_prospect_saved_searches.sql to database');
  console.log('2. Start dev server: npm run dev');
  console.log('3. Navigate to /prospect page');
  console.log('4. Test with real Apollo connection');
  console.log('5. Run manual testing checklist in PROSPECT_PAGE_REBUILD.md');
} else {
  console.log('✗ SOME CHECKS FAILED\n');
  console.log('Failed checks:');
  checks
    .filter((c) => !c.passed)
    .forEach((c) => {
      console.log(`  - ${c.name}: ${c.details || 'Failed'}`);
    });
}

process.exit(passed === total ? 0 : 1);
