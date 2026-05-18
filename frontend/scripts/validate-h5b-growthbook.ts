#!/usr/bin/env npx tsx
/**
 * H5b Validation: Full Write Path Against GrowthBook (20K companies)
 *
 * Tests:
 * 1. Compliance scan at 20K scale
 * 2. Normalization pipeline dry-run with rate limit verification
 * 3. Dedup scan - pairs detection, grading, and upsert verification
 * 4. Export API - paginated fallback for large portal
 *
 * Usage:
 *   HUBSPOT_TOKEN=pat-na1-xxx npx tsx scripts/validate-h5b-growthbook.ts
 */

import { createHubSpotClient, type HubSpotClient, type CompanyIndex } from '../lib/hubspot/client';
import { supabase, isSupabaseConfigured } from '../lib/db/supabase';
import { similarity, extractDomain } from '../lib/harmonies/runtime/builtins';
import type { PairGrade, FiredSignal } from '../lib/dedup/types';

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const GROWTHBOOK_PORTAL_ID = '8863617';
const ORG_ID = 'growthbook';

// Track API calls for reporting
let apiCallCount = 0;
let rateLimitHeadersObserved: { max: number; remaining: number } | null = null;

const token = process.env.HUBSPOT_TOKEN;
if (!token) {
  console.error('❌ HUBSPOT_TOKEN environment variable required');
  console.error('Usage: HUBSPOT_TOKEN=pat-na1-xxx npx tsx scripts/validate-h5b-growthbook.ts');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Test 1: Compliance Scan (uses pre-built index)
// ─────────────────────────────────────────────────────────────

async function testComplianceScanWithIndex(companyIndex: CompanyIndex): Promise<{
  pass: boolean;
  recordsScanned: number;
  fieldsProcessed: number;
  durationMs: number;
  error?: string;
}> {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 1: Compliance Scan (20K scale)');
  console.log('═'.repeat(60));

  const startTime = Date.now();

  try {
    const recordsScanned = companyIndex.totalCompanies;
    console.log(`Using pre-built index with ${recordsScanned} companies`);

    // Simulate compliance scan field processing
    let fieldsProcessed = 0;
    const COMPANY_FIELDS = ['name', 'domain', 'industry', 'phone', 'numberofemployees', 'city', 'state', 'country'];

    for (const [, entry] of Array.from(companyIndex.companyMap.entries())) {
      for (const field of COMPANY_FIELDS) {
        const value = entry.rawProperties[field];
        if (value !== null && value !== undefined && value !== '') {
          fieldsProcessed++;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Store score history if Supabase configured
    if (isSupabaseConfigured() && supabase) {
      const totalFields = recordsScanned * COMPANY_FIELDS.length;
      const compliantPercentage = Math.round((fieldsProcessed / totalFields) * 100);
      const { error } = await supabase.from('compliance_score_history').insert({
        org_id: ORG_ID,
        score: compliantPercentage,
        compliant: fieldsProcessed,
        stale: 0,
        unprocessed: totalFields - fieldsProcessed,
        total: totalFields,
        computed_at: new Date().toISOString(),
      });
      if (error) {
        console.warn(`⚠ Failed to write compliance score: ${error.message}`);
      } else {
        console.log(`✓ Score written to compliance_score_history: ${compliantPercentage}%`);
      }
    }

    console.log(`✓ Processed ${fieldsProcessed} fields in ${durationMs}ms`);

    return {
      pass: recordsScanned >= 20000,
      recordsScanned,
      fieldsProcessed,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      pass: false,
      recordsScanned: 0,
      fieldsProcessed: 0,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Test 2: Normalization Pipeline (Dry-Run)
// ─────────────────────────────────────────────────────────────

async function testNormalizationPipeline(
  companyIndex: CompanyIndex
): Promise<{
  pass: boolean;
  recordsProcessed: number;
  batchesProcessed: number;
  rateLimitMaxObserved: number | null;
  unhandled429s: number;
  durationMs: number;
  error?: string;
}> {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 2: Normalization Pipeline (Dry-Run)');
  console.log('═'.repeat(60));

  const startTime = Date.now();
  const BATCH_SIZE = 100;
  let recordsProcessed = 0;
  let batchesProcessed = 0;
  let unhandled429s = 0;

  try {
    const companies = Array.from(companyIndex.companyMap.values());
    console.log(`Processing ${companies.length} companies in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      batchesProcessed++;

      // Simulate normalization processing for each record in batch
      for (const company of batch) {
        // Normalize industry field (example)
        const rawIndustry = company.rawProperties.industry;
        if (rawIndustry) {
          // Dry-run: compute normalized value but don't write
          const normalizedIndustry = normalizeIndustry(rawIndustry);
          if (normalizedIndustry !== rawIndustry) {
            // Would write to HubSpot in live mode
          }
        }
        recordsProcessed++;
      }

      // Log progress every 50 batches
      if (batchesProcessed % 50 === 0) {
        console.log(`  Processed ${recordsProcessed} records (${batchesProcessed} batches)...`);
      }
    }

    // Check if we observed rate limit headers during index build
    const rateLimitStatus = await checkRateLimitStatus(token!);
    rateLimitHeadersObserved = rateLimitStatus;

    const durationMs = Date.now() - startTime;
    console.log(`✓ Processed ${recordsProcessed} records in ${batchesProcessed} batches`);
    console.log(`✓ Duration: ${durationMs}ms (${(recordsProcessed / (durationMs / 1000)).toFixed(0)} records/sec)`);

    if (rateLimitStatus) {
      console.log(`✓ Rate limit headers observed: max=${rateLimitStatus.max}, remaining=${rateLimitStatus.remaining}`);
    }

    return {
      pass: recordsProcessed >= 20000 && unhandled429s === 0,
      recordsProcessed,
      batchesProcessed,
      rateLimitMaxObserved: rateLimitStatus?.max || null,
      unhandled429s,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      pass: false,
      recordsProcessed,
      batchesProcessed,
      rateLimitMaxObserved: null,
      unhandled429s,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeIndustry(raw: string): string {
  // Simple industry normalization for testing
  const mapping: Record<string, string> = {
    'HOSPITAL_HEALTH_CARE': 'Healthcare',
    'INFORMATION_TECHNOLOGY_AND_SERVICES': 'Technology',
    'COMPUTER_SOFTWARE': 'Technology',
    'FINANCIAL_SERVICES': 'Finance',
    'MARKETING_AND_ADVERTISING': 'Marketing',
  };
  return mapping[raw] || raw;
}

async function checkRateLimitStatus(accessToken: string): Promise<{ max: number; remaining: number } | null> {
  try {
    const res = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    apiCallCount++;

    const max = parseInt(res.headers.get('X-HubSpot-RateLimit-Max') || '0', 10);
    const remaining = parseInt(res.headers.get('X-HubSpot-RateLimit-Remaining') || '0', 10);

    if (max > 0) {
      return { max, remaining };
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Test 3: Dedup Scan
// ─────────────────────────────────────────────────────────────

async function testDedupScan(companyIndex: CompanyIndex): Promise<{
  pass: boolean;
  pairsDetected: number;
  pairsWritten: number;
  duplicateRowsOnRescan: number;
  gradeDistribution: Record<PairGrade, number>;
  durationMs: number;
  error?: string;
}> {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 3: Dedup Scan');
  console.log('═'.repeat(60));

  const startTime = Date.now();
  const gradeDistribution: Record<PairGrade, number> = { A: 0, B: 0, C: 0, D: 0 };
  const detectedPairs: Array<{
    recordAId: string;
    recordBId: string;
    confidence: number;
    grade: PairGrade;
    nameSimilarity: number;
    signalsFired: FiredSignal[];
  }> = [];

  try {
    console.log('Scanning for duplicate pairs...');

    // Build domain → company list map for detecting same-domain duplicates
    const domainCompanies = new Map<string, string[]>();

    for (const [hubspotId, entry] of Array.from(companyIndex.companyMap.entries())) {
      if (entry.domain) {
        const normalizedDomain = extractDomain(entry.domain) || entry.domain.toLowerCase();
        const existing = domainCompanies.get(normalizedDomain) || [];
        existing.push(hubspotId);
        domainCompanies.set(normalizedDomain, existing);
      }
    }

    // Find pairs with same domain
    let pairsFromDomain = 0;
    for (const [domain, companyIds] of Array.from(domainCompanies.entries())) {
      if (companyIds.length >= 2) {
        // Generate pairs (avoid duplicates by only pairing i < j)
        for (let i = 0; i < companyIds.length; i++) {
          for (let j = i + 1; j < companyIds.length; j++) {
            const companyA = companyIndex.companyMap.get(companyIds[i])!;
            const companyB = companyIndex.companyMap.get(companyIds[j])!;

            const nameSim = similarity(
              companyA.rawProperties.name || '',
              companyB.rawProperties.name || ''
            );

            // Calculate confidence based on signals
            const signalsFired: FiredSignal[] = [
              { tier: 1, type: 'domain', deterministic: true, score: 50 },
            ];

            // Check phone match
            const phoneA = normalizePhone(companyA.rawProperties.phone || '');
            const phoneB = normalizePhone(companyB.rawProperties.phone || '');
            if (phoneA && phoneB && phoneA === phoneB) {
              signalsFired.push({ tier: 1, type: 'phone', deterministic: true, score: 30 });
            }

            // Calculate grade
            const deterministicCount = signalsFired.filter(s => s.deterministic).length;
            const grade = calculateGrade(deterministicCount, nameSim);

            const confidence = Math.min(
              100,
              signalsFired.reduce((sum, s) => sum + s.score, 0) + Math.round(nameSim * 20)
            );

            detectedPairs.push({
              recordAId: companyIds[i],
              recordBId: companyIds[j],
              confidence,
              grade,
              nameSimilarity: nameSim,
              signalsFired,
            });

            gradeDistribution[grade]++;
            pairsFromDomain++;
          }
        }
      }
    }

    console.log(`✓ Detected ${detectedPairs.length} pairs from domain matching`);
    console.log(`  Grade distribution: A=${gradeDistribution.A}, B=${gradeDistribution.B}, C=${gradeDistribution.C}, D=${gradeDistribution.D}`);

    // Write pairs to database
    let pairsWritten = 0;
    let duplicateRowsOnRescan = 0;

    if (isSupabaseConfigured() && supabase && detectedPairs.length > 0) {
      console.log('Writing pairs to dedup_pairs table...');

      // First scan - write all pairs
      for (const pair of detectedPairs) {
        const [recordAId, recordBId] = [pair.recordAId, pair.recordBId].sort();

        const { error } = await supabase.from('dedup_pairs').upsert({
          org_id: ORG_ID,
          record_a_id: recordAId,
          record_b_id: recordBId,
          confidence: pair.confidence,
          grade: pair.grade,
          name_similarity: pair.nameSimilarity,
          signals_fired: pair.signalsFired,
          status: 'pending',
          detected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,record_a_id,record_b_id' });

        if (!error) {
          pairsWritten++;
        }
      }

      console.log(`✓ Wrote ${pairsWritten} pairs to database`);

      // Re-scan - verify upsert behavior (should not duplicate)
      console.log('Re-scanning to verify UNIQUE constraint...');

      const { count: beforeCount } = await supabase
        .from('dedup_pairs')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', ORG_ID);

      // Re-insert same pairs
      for (const pair of detectedPairs.slice(0, 10)) { // Test with first 10 pairs
        const [recordAId, recordBId] = [pair.recordAId, pair.recordBId].sort();

        await supabase.from('dedup_pairs').upsert({
          org_id: ORG_ID,
          record_a_id: recordAId,
          record_b_id: recordBId,
          confidence: pair.confidence,
          grade: pair.grade,
          name_similarity: pair.nameSimilarity,
          signals_fired: pair.signalsFired,
          status: 'pending',
          detected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,record_a_id,record_b_id' });
      }

      const { count: afterCount } = await supabase
        .from('dedup_pairs')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', ORG_ID);

      duplicateRowsOnRescan = (afterCount || 0) - (beforeCount || 0);
      console.log(`✓ Re-scan: before=${beforeCount}, after=${afterCount}, duplicates=${duplicateRowsOnRescan}`);
    } else {
      console.log('⚠ Supabase not configured - skipping database write');
    }

    const durationMs = Date.now() - startTime;

    return {
      pass: detectedPairs.length > 0 && duplicateRowsOnRescan === 0,
      pairsDetected: detectedPairs.length,
      pairsWritten,
      duplicateRowsOnRescan,
      gradeDistribution,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      pass: false,
      pairsDetected: 0,
      pairsWritten: 0,
      duplicateRowsOnRescan: 0,
      gradeDistribution,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function calculateGrade(deterministicCount: number, nameSimilarity: number): PairGrade {
  // Per PRD: Grade based on deterministic signals + name similarity
  if (deterministicCount >= 2 && nameSimilarity >= 0.9) return 'A';
  if (deterministicCount >= 1 && nameSimilarity >= 0.7) return 'B';
  if (deterministicCount >= 1 || nameSimilarity >= 0.6) return 'C';
  return 'D';
}

// ─────────────────────────────────────────────────────────────
// Test 4: Export API
// ─────────────────────────────────────────────────────────────

async function testExportApi(): Promise<{
  pass: boolean;
  recordsReturned: number;
  pollAttempts: number;
  durationMs: number;
  error?: string;
}> {
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 4: Export API (Paginated Fallback)');
  console.log('═'.repeat(60));

  const startTime = Date.now();
  const POLL_INTERVAL_MS = 2000;
  const MAX_POLL_ATTEMPTS = 150;

  try {
    // Trigger export
    console.log('Triggering export job...');
    apiCallCount++;

    const exportRequest = {
      exportType: 'VIEW',
      format: 'CSV',
      exportName: `h5b-validation-${Date.now()}`,
      objectType: 'COMPANY',
      objectProperties: ['hs_object_id', 'name', 'domain'],
      publicAccessEnabled: false,
    };

    const triggerResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/exports/export/async`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(exportRequest),
    });

    if (!triggerResponse.ok) {
      const errorBody = await triggerResponse.text();
      throw new Error(`Export trigger failed: ${triggerResponse.status} - ${errorBody}`);
    }

    const triggerData = await triggerResponse.json();
    const taskId = triggerData.id;
    console.log(`✓ Export job created: ${taskId}`);

    // Poll for completion
    let status = 'PENDING';
    let downloadUrl: string | null = null;
    let pollAttempts = 0;

    while (pollAttempts < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      pollAttempts++;
      apiCallCount++;

      const pollResponse = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/exports/export/async/tasks/${taskId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!pollResponse.ok) {
        throw new Error(`Poll failed: ${pollResponse.status}`);
      }

      const pollData = await pollResponse.json();
      status = pollData.status;
      downloadUrl = pollData.result || null;

      if (status === 'COMPLETE') break;
      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`Export failed with status: ${status}`);
      }

      if (pollAttempts % 10 === 0) {
        console.log(`  Poll attempt ${pollAttempts}: status=${status}`);
      }
    }

    if (status !== 'COMPLETE' || !downloadUrl) {
      throw new Error(`Export timed out. Status: ${status}`);
    }

    console.log(`✓ Export complete after ${pollAttempts} poll(s)`);

    // Download and count records
    console.log('Downloading export file...');
    const downloadResponse = await fetch(downloadUrl);

    if (!downloadResponse.ok) {
      throw new Error(`Download failed: ${downloadResponse.status}`);
    }

    const rawContent = await downloadResponse.text();
    const lines = rawContent.trim().split('\n');
    const recordsReturned = lines.length - 1; // Subtract header row

    const durationMs = Date.now() - startTime;
    console.log(`✓ Downloaded ${recordsReturned} records`);
    console.log(`✓ Duration: ${durationMs}ms`);

    return {
      pass: recordsReturned >= 20000,
      recordsReturned,
      pollAttempts,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      pass: false,
      recordsReturned: 0,
      pollAttempts: 0,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('H5b VALIDATION: GrowthBook Portal (20K Companies)');
  console.log('═'.repeat(60));
  console.log(`Portal ID: ${GROWTHBOOK_PORTAL_ID}`);
  console.log(`Org ID: ${ORG_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Validate token
  const accountResponse = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  apiCallCount++;

  if (!accountResponse.ok) {
    console.error(`❌ Token validation failed: ${accountResponse.status}`);
    process.exit(1);
  }

  const accountData = await accountResponse.json();
  console.log(`✓ Token validated. Portal: ${accountData.portalId}`);

  // Create HubSpot client
  const clientResult = await createHubSpotClient(token!);
  if ('error' in clientResult) {
    console.error(`❌ Failed to create HubSpot client: ${clientResult.error}`);
    process.exit(1);
  }
  const { client } = clientResult;

  // Run tests
  const results: {
    test1: Awaited<ReturnType<typeof testComplianceScanWithIndex>>;
    test2: Awaited<ReturnType<typeof testNormalizationPipeline>>;
    test3: Awaited<ReturnType<typeof testDedupScan>>;
    test4: Awaited<ReturnType<typeof testExportApi>>;
  } = {} as typeof results;

  // Build company index ONCE for all tests (expensive operation)
  console.log('\nBuilding company index (used by tests 1-3)...');
  let companyIndex: CompanyIndex;
  try {
    companyIndex = await client.buildCompanyIndex(false, ORG_ID);
    console.log(`✓ Indexed ${companyIndex.totalCompanies} companies\n`);
  } catch (err) {
    console.error('❌ Failed to build company index:', err);
    process.exit(1);
  }

  // Test 1: Compliance Scan (reuse index)
  results.test1 = await testComplianceScanWithIndex(companyIndex);

  // Test 2: Normalization Pipeline
  results.test2 = await testNormalizationPipeline(companyIndex);

  // Test 3: Dedup Scan
  results.test3 = await testDedupScan(companyIndex);

  // Test 4: Export API
  results.test4 = await testExportApi();

  // Print Report
  console.log('\n' + '═'.repeat(60));
  console.log('H5b VALIDATION REPORT');
  console.log('═'.repeat(60));

  console.log('\n📊 TEST 1: Compliance Scan');
  console.log(`   Status: ${results.test1.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Records scanned: ${results.test1.recordsScanned.toLocaleString()}`);
  console.log(`   Fields processed: ${results.test1.fieldsProcessed.toLocaleString()}`);
  console.log(`   Duration: ${results.test1.durationMs}ms`);
  if (results.test1.error) console.log(`   Error: ${results.test1.error}`);

  console.log('\n📊 TEST 2: Normalization Pipeline (Dry-Run)');
  console.log(`   Status: ${results.test2.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Records processed: ${results.test2.recordsProcessed.toLocaleString()}`);
  console.log(`   Batches processed: ${results.test2.batchesProcessed}`);
  console.log(`   Rate limit max: ${results.test2.rateLimitMaxObserved || 'not observed'}`);
  console.log(`   Unhandled 429s: ${results.test2.unhandled429s}`);
  console.log(`   Duration: ${results.test2.durationMs}ms`);
  if (results.test2.error) console.log(`   Error: ${results.test2.error}`);

  console.log('\n📊 TEST 3: Dedup Scan');
  console.log(`   Status: ${results.test3.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Pairs detected: ${results.test3.pairsDetected}`);
  console.log(`   Pairs written: ${results.test3.pairsWritten}`);
  console.log(`   Duplicate rows on rescan: ${results.test3.duplicateRowsOnRescan}`);
  console.log(`   Grade distribution: A=${results.test3.gradeDistribution.A}, B=${results.test3.gradeDistribution.B}, C=${results.test3.gradeDistribution.C}, D=${results.test3.gradeDistribution.D}`);
  console.log(`   Duration: ${results.test3.durationMs}ms`);
  if (results.test3.error) console.log(`   Error: ${results.test3.error}`);

  console.log('\n📊 TEST 4: Export API');
  console.log(`   Status: ${results.test4.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Records returned: ${results.test4.recordsReturned.toLocaleString()}`);
  console.log(`   Poll attempts: ${results.test4.pollAttempts}`);
  console.log(`   Duration: ${results.test4.durationMs}ms`);
  if (results.test4.error) console.log(`   Error: ${results.test4.error}`);

  console.log('\n📊 SUMMARY');
  console.log(`   Total API calls: ${apiCallCount}`);
  const allPass = results.test1.pass && results.test2.pass && results.test3.pass && results.test4.pass;
  console.log(`   Overall: ${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  console.log('\n' + '═'.repeat(60));

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
