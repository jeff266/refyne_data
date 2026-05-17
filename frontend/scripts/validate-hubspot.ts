#!/usr/bin/env npx tsx
/**
 * HubSpot H1 Validation Script
 *
 * Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/validate-hubspot.ts
 *
 * Tests:
 * 1. Token validation and scope check
 * 2. Fetch company lists
 * 3. Pull companies from first list (or all companies if no lists)
 * 4. Map to canonical format and display sample output
 */

import { validateToken, HubSpotClient } from '../lib/hubspot/client';
import { hubspotToRawRecords, getMappingSummary } from '../lib/hubspot/field-mapper';
import { DEFAULT_FIELD_MAPPINGS } from '../lib/hubspot/types';
import type { FieldMapping } from '../lib/hubspot/types';

const token = process.env.HUBSPOT_TOKEN;

if (!token) {
  console.error('❌ HUBSPOT_TOKEN environment variable is required');
  console.error('Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/validate-hubspot.ts');
  process.exit(1);
}

const defaultMappings: FieldMapping[] = DEFAULT_FIELD_MAPPINGS.map((m, i) => ({
  id: `default-${i}`,
  canonicalField: m.canonicalField,
  hubspotProperty: m.hubspotProperty,
  direction: 'bidirectional' as const,
  writePolicy: 'overwrite_if_blank_or_ours' as const,
  validValues: null,
  fieldType: null,
  canonicalToHubspotMap: null,
  isActive: true,
}));

async function main() {
  console.log('🔄 HubSpot H1 Validation\n');
  console.log('='.repeat(60) + '\n');

  // Step 1: Validate token
  console.log('1️⃣  Validating token...');
  const validation = await validateToken(token!);

  if (!validation.valid) {
    console.error(`❌ Token validation failed: ${validation.error}`);
    if (validation.missingScopes) {
      console.error(`   Missing scopes: ${validation.missingScopes.join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`✅ Token valid`);
  console.log(`   Portal ID: ${validation.portalId}`);
  console.log(`   Scopes: ${validation.scopes?.join(', ')}\n`);

  // Step 2: Create client and fetch lists
  console.log('2️⃣  Fetching company lists...');
  const client = new HubSpotClient(token!, validation.portalId!);

  let lists;
  try {
    lists = await client.getCompanyLists();
    console.log(`✅ Found ${lists.length} company lists`);
    if (lists.length > 0) {
      for (const list of lists.slice(0, 5)) {
        console.log(`   - ${list.name} (${list.memberCount} companies)`);
      }
      if (lists.length > 5) {
        console.log(`   ... and ${lists.length - 5} more`);
      }
    }
    console.log();
  } catch (error) {
    console.error(`❌ Failed to fetch lists: ${error}`);
    process.exit(1);
  }

  // Step 3: Pull companies
  console.log('3️⃣  Pulling companies...');

  let companies: Awaited<ReturnType<typeof client.getCompaniesByIds>> = [];

  try {
    if (lists.length > 0) {
      // Pull from first list
      const selectedList = lists[0];
      console.log(`   Pulling from list: ${selectedList.name}`);

      for await (const batch of client.getListMembers(selectedList.listId)) {
        companies.push(...batch);
        if (companies.length >= 100) break; // Limit for validation
      }
    } else {
      // Pull all companies
      console.log('   No lists found, pulling all companies...');

      for await (const batch of client.getAllCompanies()) {
        companies.push(...batch);
        if (companies.length >= 100) break; // Limit for validation
      }
    }

    console.log(`✅ Pulled ${companies.length} companies\n`);
  } catch (error) {
    console.error(`❌ Failed to pull companies: ${error}`);
    process.exit(1);
  }

  if (companies.length === 0) {
    console.log('⚠️  No companies found in portal');
    process.exit(0);
  }

  // Step 4: Map to canonical format
  console.log('4️⃣  Mapping to canonical format...');
  const records = hubspotToRawRecords(companies, defaultMappings);
  const summary = getMappingSummary(companies, defaultMappings);

  console.log(`✅ Mapped ${records.length} records`);
  console.log(`   Mapped fields: ${summary.mappedFields.join(', ')}`);
  if (summary.unmappedHubSpotProperties.length > 0) {
    console.log(`   Unmapped HubSpot properties: ${summary.unmappedHubSpotProperties.slice(0, 10).join(', ')}${summary.unmappedHubSpotProperties.length > 10 ? '...' : ''}`);
  }
  console.log();

  // Step 5: Display sample canonical output
  console.log('5️⃣  Sample Canonical Output (3-5 companies):\n');
  console.log('='.repeat(60));

  const samplesToShow = Math.min(5, records.length);

  for (let i = 0; i < samplesToShow; i++) {
    const record = records[i];
    console.log(`\n📋 Company ${i + 1}: ${record._label || record._id}`);
    console.log('-'.repeat(40));

    // Show mapped canonical fields
    const fieldsToShow = [
      ['_hubspot_id', record._hubspot_id],
      ['name', record.name],
      ['domain', record.domain],
      ['industry', record.industry],
      ['annual_revenue', record.annual_revenue],
      ['employee_count', record.employee_count],
      ['phone', record.phone],
      ['hq_city', record.hq_city],
      ['hq_state', record.hq_state],
      ['hq_country', record.hq_country],
      ['hq_postal_code', record.hq_postal_code],
      ['hq_address', record.hq_address],
      ['website', record.website],
      ['linkedin_url', record.linkedin_url],
      ['description', record.description ? `${String(record.description).slice(0, 50)}...` : null],
    ];

    for (const [field, value] of fieldsToShow) {
      if (value !== undefined && value !== null) {
        console.log(`  ${field}: ${value}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ H1 Validation Complete!');
  console.log(`   Portal: ${validation.portalId}`);
  console.log(`   Companies pulled: ${companies.length}`);
  console.log(`   Records mapped: ${records.length}`);
}

main().catch(console.error);
