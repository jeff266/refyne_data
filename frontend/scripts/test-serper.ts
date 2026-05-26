#!/usr/bin/env npx tsx
/**
 * Test Serper queries for a specific domain/company
 * Usage: REFYNE_SERPER_KEY=xxx npx tsx scripts/test-serper.ts <domain> <companyName>
 */

import { searchWeb, buildCompanyQueries } from '../lib/providers/refyne-search/serper-client';

async function test() {
  const domain = process.argv[2];
  const companyName = process.argv[3];

  if (!domain) {
    console.error('Usage: npx tsx scripts/test-serper.ts <domain> [companyName]');
    process.exit(1);
  }

  console.log('Testing Serper queries');
  console.log('Domain:', domain);
  console.log('Company Name:', companyName || '(none)');
  console.log('');

  // Test with all field keys to see maximum queries
  const fieldKeys = ['industry', 'employee_count', 'revenue', 'phone', 'linkedin_url'];
  const queries = buildCompanyQueries(domain, companyName || null, fieldKeys);

  console.log(`Generated ${queries.length} queries:`);
  queries.forEach((q, i) => {
    console.log(`  ${i + 1}. "${q}"`);
  });
  console.log('');

  // Run each query and show results
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\n========== Query ${i + 1} ==========`);
    console.log(`Query: "${query}"`);
    console.log('');

    try {
      const results = await searchWeb(query, 5);

      if (results.length === 0) {
        console.log('❌ No results found');
      } else {
        console.log(`✅ Found ${results.length} results:\n`);
        results.forEach((r, idx) => {
          console.log(`${idx + 1}. ${r.title}`);
          console.log(`   ${r.link}`);
          console.log(`   ${r.snippet.substring(0, 150)}...`);
          console.log('');
        });
      }
    } catch (error: any) {
      console.error('❌ Query failed:', error.message);
    }
  }

  console.log('\n========== Summary ==========');
  console.log(`Domain: ${domain}`);
  console.log(`Company Name: ${companyName || '(none)'}`);
  console.log(`Queries tested: ${queries.length}`);
}

test().catch(console.error);
