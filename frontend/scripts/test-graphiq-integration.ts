#!/usr/bin/env npx tsx
/**
 * GraphIQ Integration Test
 *
 * Verifies that GraphIQ provider is properly integrated with:
 * - API key retrieval from provider_connections
 * - Provider adapter initialization
 * - Company enrichment
 *
 * Usage:
 *   GRAPHIQ_API_KEY=api_xxx npx tsx scripts/test-graphiq-integration.ts
 */

import { GraphiqAdapter } from '../lib/providers/graphiq';
import { getGraphiqKey } from '../lib/providers/graphiq-key';

async function main() {
  console.log('═'.repeat(60));
  console.log('GraphIQ Integration Test');
  console.log('═'.repeat(60));
  console.log();

  // Test 1: API key retrieval
  console.log('Test 1: API Key Retrieval');
  console.log('─'.repeat(60));

  try {
    const apiKey = await getGraphiqKey();
    if (!apiKey) {
      console.error('❌ No API key found');
      process.exit(1);
    }
    console.log(`✅ API key retrieved: ${apiKey.substring(0, 10)}...`);
  } catch (error) {
    console.error('❌ Error retrieving API key:', error);
    process.exit(1);
  }
  console.log();

  // Test 2: Adapter initialization
  console.log('Test 2: GraphIQ Adapter Initialization');
  console.log('─'.repeat(60));

  try {
    const apiKey = await getGraphiqKey();
    const adapter = new GraphiqAdapter(apiKey!);
    console.log(`✅ Adapter initialized: id="${adapter.id}", name="${adapter.name}"`);
  } catch (error) {
    console.error('❌ Error initializing adapter:', error);
    process.exit(1);
  }
  console.log();

  // Test 3: Company enrichment
  console.log('Test 3: Company Enrichment');
  console.log('─'.repeat(60));

  try {
    const apiKey = await getGraphiqKey();
    const adapter = new GraphiqAdapter(apiKey!);

    const testDomain = 'stripe.com';
    console.log(`Enriching domain: ${testDomain}...`);

    const result = await adapter.enrichCompany({ domain: testDomain });

    if (!result) {
      console.error('❌ No result returned');
      process.exit(1);
    }

    console.log(`✅ Enrichment successful`);
    console.log(`   Source: ${result._source}`);
    console.log(`   Retrieved at: ${result._retrieved_at}`);

    if (result.normalized) {
      console.log(`   Normalized fields:`);
      console.log(`     - name: ${result.normalized.name}`);
      console.log(`     - domain: ${result.normalized.domain}`);
      console.log(`     - industry: ${result.normalized.industry}`);
      console.log(`     - naics_code: ${result.normalized.naics_code}`);
      console.log(`     - employee_count: ${result.normalized.employee_count}`);
      console.log(`     - location: ${result.normalized.location}`);
    }
  } catch (error) {
    console.error('❌ Error enriching company:', error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
  console.log();

  console.log('═'.repeat(60));
  console.log('✅ All tests passed!');
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
