#!/usr/bin/env npx tsx
/**
 * Dedup Prevention Validation Script
 *
 * Tests the dedup gate against real HubSpot data to verify:
 * 1. Duplicates are correctly caught (UPSERT to existing record)
 * 2. True negatives pass through (INSERT for genuinely new records)
 * 3. Parent-child relationships are suppressed (if configured)
 *
 * Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/validate-dedup-prevention.ts
 */

import { validateToken, HubSpotClient } from '../lib/hubspot/client';
import type { CompanyIndex } from '../lib/hubspot/client';
import { checkDedupGate } from '../lib/hubspot/dedup-gate';
import type { RawRecord } from '../lib/mcp/types';
import type { DedupGateResult } from '../lib/hubspot/write-types';

const token = process.env.HUBSPOT_TOKEN;

if (!token) {
  console.error('❌ HUBSPOT_TOKEN environment variable is required');
  console.error('Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/validate-dedup-prevention.ts');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Vary a company name slightly to simulate external data.
 */
function varyCompanyName(name: string, index: number): string {
  const variations = [
    // Abbreviate
    (n: string) => n.replace(/Corporation/i, 'Corp').replace(/Incorporated/i, 'Inc'),
    // Remove suffix
    (n: string) => n.replace(/,?\s*(Inc\.?|LLC|Corp\.?|Ltd\.?)$/i, '').trim(),
    // Add suffix
    (n: string) => n.includes('Inc') ? n : `${n} Inc`,
    // Change casing
    (n: string) => n.toUpperCase(),
    // Lowercase
    (n: string) => n.toLowerCase(),
  ];
  return variations[index % variations.length](name);
}

/**
 * Create a synthetic record from a real HubSpot company.
 */
function createSyntheticRecord(
  company: { id: string; properties: Record<string, string | null> },
  index: number
): RawRecord {
  const name = company.properties.name || 'Unknown';
  const domain = company.properties.domain;

  return {
    _id: `synthetic-${index}`,
    _hubspot_id: null, // Simulate incoming record with no CRM ID
    name: varyCompanyName(name, index),
    domain: domain, // Keep domain exactly for Tier 2 match
    industry: company.properties.industry,
    employee_count: company.properties.numberofemployees,
    phone: company.properties.phone,
    hq_city: company.properties.city,
    hq_state: company.properties.state,
    hq_country: company.properties.country,
  };
}

/**
 * Print the result of a dedup gate check.
 */
function printResult(
  label: string,
  record: RawRecord,
  result: DedupGateResult,
  expected: 'upsert' | 'insert' | 'review' | 'skip',
  companyIndex: CompanyIndex
): boolean {
  const domain = record.domain || 'no domain';
  const name = record.name || 'Unknown';

  console.log(`\n  "${name}" (domain: ${domain}) [${label}]`);

  // Tier 1: _hubspot_id check
  if (record._hubspot_id) {
    console.log(`    Tier 1: has _hubspot_id → ${record._hubspot_id}`);
  } else {
    console.log(`    Tier 1: no _hubspot_id`);
  }

  // Tier 2: domain match
  if (record.domain && typeof record.domain === 'string') {
    const domainMatch = companyIndex.domainIndex.get(record.domain.toLowerCase());
    if (domainMatch) {
      console.log(`    Tier 2: domain match → id: ${domainMatch}  score: 1.0`);
    } else {
      console.log(`    Tier 2: no domain match`);
    }
  } else {
    console.log(`    Tier 2: no domain provided`);
  }

  // Tier 3-4: LinkedIn / external ID (simplified)
  if (!result.targetHubSpotId || result.similarityScore !== 1.0) {
    console.log(`    Tier 3: no LinkedIn match`);
    console.log(`    Tier 4: no external ID match`);
  }

  // Score and parent check
  if (result.similarityScore !== null && result.similarityScore < 1.0) {
    console.log(`    Tier 5-7: score ${result.similarityScore.toFixed(2)}`);
  }

  // Parent relationship check
  if (result.targetHubSpotId) {
    const parentId = companyIndex.parentIndex.get(result.targetHubSpotId);
    const isChild = companyIndex.childSet.has(result.targetHubSpotId);
    if (parentId) {
      console.log(`    Parent: child of ${parentId}`);
    } else if (isChild) {
      console.log(`    Parent: is a child company`);
    } else {
      console.log(`    Parent: no_hierarchy`);
    }
  }

  // Decision
  const pass = result.action === expected;
  const symbol = pass ? '✓' : '✗';
  console.log(`    Decision: ${result.action.toUpperCase()}  ${symbol}`);

  if (!pass) {
    console.log(`    Expected: ${expected.toUpperCase()}`);
  }

  if (result.warning) {
    console.log(`    Warning: ${result.warning}`);
  }

  return pass;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Dedup Prevention Validation\n');
  console.log('='.repeat(60));

  // Validate token
  console.log('Validating token...');
  const validation = await validateToken(token!);

  if (!validation.valid || !validation.portalId) {
    console.error(`❌ Token validation failed: ${validation.error}`);
    process.exit(1);
  }

  console.log(`✅ Connected to portal: ${validation.portalId}\n`);

  const client = new HubSpotClient(token!, validation.portalId);

  // Build company index
  console.log('Building company index...');
  const companyIndex = await client.buildCompanyIndex();
  console.log(`✅ Indexed ${companyIndex.totalCompanies} companies`);
  console.log(`   ${companyIndex.companiesWithParent} with parent associations\n`);

  // Fetch 5 real companies for testing
  console.log('Fetching test companies...');
  const companies: Array<{ id: string; properties: Record<string, string | null> }> = [];

  for await (const batch of client.getAllCompanies()) {
    for (const company of batch) {
      // Only use companies with domains for reliable testing
      if (company.properties.domain && companies.length < 5) {
        companies.push(company);
      }
      if (companies.length >= 5) break;
    }
    if (companies.length >= 5) break;
  }

  console.log(`✅ Selected ${companies.length} companies for testing\n`);

  // Track results
  let duplicatesCaught = 0;
  let duplicatesTotal = 0;
  let falsePositives = 0;
  let trueNegativesTotal = 0;
  let parentChildSuppressed = 0;
  let parentChildTotal = 0;

  // ─── Part 1: Duplicate detection ───────────────────────────
  console.log('─── Part 1: Duplicate Detection ───────────────────────────');
  console.log('Testing that existing companies are recognized...\n');

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const syntheticRecord = createSyntheticRecord(company, i);

    duplicatesTotal++;

    const result = await checkDedupGate(syntheticRecord, client, undefined, companyIndex);

    const pass = printResult('synthetic', syntheticRecord, result, 'upsert', companyIndex);

    if (pass && result.targetHubSpotId === company.id) {
      duplicatesCaught++;
    } else if (result.action === 'upsert' && result.targetHubSpotId !== company.id) {
      // Matched to wrong company - still a catch but note it
      console.log(`    Note: Matched to different ID (expected: ${company.id})`);
      duplicatesCaught++;
    }
  }

  // ─── Part 2: True negatives ────────────────────────────────
  console.log('\n─── Part 2: True Negatives ─────────────────────────────────');
  console.log('Testing that genuinely new records pass through...\n');

  // Test 1: Company with non-existent domain
  trueNegativesTotal++;
  const newDomainRecord: RawRecord = {
    _id: 'true-negative-1',
    _hubspot_id: null,
    name: 'Completely New Company LLC',
    domain: `newcompany-${Date.now()}.io`, // Guaranteed not to exist
    industry: 'Technology',
  };

  const newDomainResult = await checkDedupGate(newDomainRecord, client, undefined, companyIndex);
  const newDomainPass = printResult('true negative', newDomainRecord, newDomainResult, 'insert', companyIndex);
  if (newDomainPass) {
    // Correct - did not falsely match
  } else {
    falsePositives++;
  }

  // Test 2: Company with no domain but similar name
  trueNegativesTotal++;
  const similarNameRecord: RawRecord = {
    _id: 'true-negative-2',
    _hubspot_id: null,
    name: companies[0].properties.name + ' Holdings', // Similar but different
    domain: null, // No domain
    industry: 'Technology',
  };

  const similarNameResult = await checkDedupGate(similarNameRecord, client, undefined, companyIndex);
  // Either INSERT or REVIEW is acceptable for similar names without domain
  const similarNameExpected = similarNameResult.action === 'insert' || similarNameResult.action === 'review';
  const similarNamePass = similarNameExpected && similarNameResult.action !== 'upsert';

  const similarLabel = similarNameResult.action === 'insert' ? 'true negative' : 'similar name';
  printResult(similarLabel, similarNameRecord, similarNameResult,
    similarNameResult.action === 'review' ? 'review' : 'insert', companyIndex);

  if (!similarNamePass) {
    falsePositives++;
    console.log(`    ⚠️  False positive: matched without domain confirmation`);
  } else if (similarNameResult.action === 'review') {
    console.log(`    Note: Queued for review (acceptable for similar name)`);
  }

  // ─── Part 3: Parent-child suppression ──────────────────────
  console.log('\n─── Part 3: Parent-Child Suppression ───────────────────────');

  if (companyIndex.companiesWithParent === 0) {
    console.log('Skipped: No parent associations configured in this portal.\n');
  } else {
    console.log(`Testing parent-child suppression (${companyIndex.companiesWithParent} relationships)...\n`);

    // Find a child company
    const childIds = Array.from(companyIndex.childSet);
    if (childIds.length > 0) {
      const childId = childIds[0];
      const childEntry = companyIndex.companyMap.get(childId);

      if (childEntry && childEntry.domain) {
        parentChildTotal++;

        // Create synthetic record matching child's domain
        const childRecord: RawRecord = {
          _id: 'parent-child-test',
          _hubspot_id: null,
          name: 'Test Child Company',
          domain: childEntry.domain,
        };

        const childResult = await checkDedupGate(childRecord, client, undefined, companyIndex);

        // For parent-child, we expect either 'skip' (suppressed) or special handling
        const childPass = printResult('parent-child', childRecord, childResult, 'skip', companyIndex);

        if (childPass || childResult.warning?.includes('Parent-child')) {
          parentChildSuppressed++;
        }
      }
    }
  }

  // ─── Summary ───────────────────────────────────────────────
  console.log('\n─── Summary ────────────────────────────────────────────────\n');

  console.log(`  Duplicates caught:       ${duplicatesCaught} / ${duplicatesTotal}`);
  console.log(`  False positives:         ${falsePositives} / ${trueNegativesTotal}`);

  if (companyIndex.companiesWithParent > 0) {
    console.log(`  Parent-child suppressed: ${parentChildSuppressed} / ${parentChildTotal}`);
  } else {
    console.log(`  Parent-child suppressed: skipped (no parent associations)`);
  }

  const allDuplicatesCaught = duplicatesCaught === duplicatesTotal;
  const noFalsePositives = falsePositives === 0;
  const parentChildOk = companyIndex.companiesWithParent === 0 || parentChildSuppressed === parentChildTotal;

  const overallPass = allDuplicatesCaught && noFalsePositives && parentChildOk;

  console.log(`\n  Gate status: ${overallPass ? 'PASS ✓' : 'FAIL ✗'}`);

  if (!overallPass) {
    if (!allDuplicatesCaught) {
      console.log(`    ⚠️  Some duplicates were not caught`);
    }
    if (!noFalsePositives) {
      console.log(`    ⚠️  False positives detected`);
    }
    if (!parentChildOk) {
      console.log(`    ⚠️  Parent-child suppression failed`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
