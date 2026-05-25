#!/usr/bin/env npx tsx
/**
 * GraphIQ Simple Integration Test
 *
 * Quick test that GraphIQ provider works without database dependencies.
 *
 * Usage:
 *   GRAPHIQ_API_KEY=api_xxx npx tsx scripts/test-graphiq-simple.ts
 */

import { GraphiqAdapter } from '../lib/providers/graphiq';

async function main() {
  console.log('═'.repeat(60));
  console.log('GraphIQ Simple Integration Test');
  console.log('═'.repeat(60));
  console.log();

  // Get API key from env or use hardcoded fallback
  const apiKey = process.env.GRAPHIQ_API_KEY || 'api_MKHC2ZREQ0paxXqI2vM2VPJMlxILndy2wGPCCEAOHYw';
  console.log(`Using API key: ${apiKey.substring(0, 15)}...`);
  console.log();

  // Test GraphIQ adapter
  console.log('Test: GraphIQ Company Enrichment');
  console.log('─'.repeat(60));

  try {
    const adapter = new GraphiqAdapter(apiKey);
    console.log(`✅ Adapter initialized: id="${adapter.id}", name="${adapter.name}"`);
    console.log();

    const testDomain = 'stripe.com';
    console.log(`Enriching domain: ${testDomain}...`);

    const result = await adapter.enrichCompany({ domain: testDomain });

    if (!result) {
      console.error('❌ No result returned (company not found in GraphIQ)');
      process.exit(1);
    }

    console.log(`✅ Enrichment successful`);
    console.log(`   Source: ${result._source}`);
    console.log(`   Retrieved at: ${result._retrieved_at}`);
    console.log();

    if (result.normalized) {
      console.log(`   Normalized fields:`);
      console.log(`     - name: ${result.normalized.name}`);
      console.log(`     - domain: ${result.normalized.domain}`);
      console.log(`     - industry: ${result.normalized.industry}`);
      console.log(`     - naics_code: ${result.normalized.naics_code}`);
      console.log(`     - employee_count: ${result.normalized.employee_count}`);
      console.log(`     - location: ${result.normalized.location}`);
    }
    console.log();

    console.log('═'.repeat(60));
    console.log('✅ GraphIQ integration test passed!');
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('❌ Error during enrichment:', error);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
