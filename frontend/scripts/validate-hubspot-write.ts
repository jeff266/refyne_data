#!/usr/bin/env npx tsx
/**
 * HubSpot H2 Write Path Validation Script
 *
 * Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/validate-hubspot-write.ts [--dry-run]
 *
 * Tests:
 * 1. Read 100 companies from HubSpot
 * 2. Build company index (domain, LinkedIn, parent associations)
 * 3. Map to canonical format
 * 4. Apply company-industry harmony (normalize HOSPITAL_HEALTH_CARE → Healthcare)
 * 5. Write back to HubSpot (or dry-run to simulate)
 * 6. Report results: records written, fields updated, policy skips, dedup outcomes
 */

import { validateToken, HubSpotClient } from '../lib/hubspot/client';
import { hubspotToRawRecords } from '../lib/hubspot/field-mapper';
import { executeBatchWrite } from '../lib/hubspot/batch-writer';
import { DEFAULT_FIELD_MAPPINGS } from '../lib/hubspot/types';
import type { FieldMapping, HubSpotCompany } from '../lib/hubspot/types';
import type { RawRecord } from '../lib/mcp/types';
import type { RecordWriteResult, FieldWriteDecision } from '../lib/hubspot/write-types';

const token = process.env.HUBSPOT_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!token) {
  console.error('❌ HUBSPOT_TOKEN environment variable is required');
  console.error('Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/validate-hubspot-write.ts [--dry-run]');
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

/**
 * HubSpot industry enum to canonical mapping.
 * This normalizes HubSpot's internal values to display-friendly values.
 */
const HUBSPOT_INDUSTRY_MAP: Record<string, string> = {
  ACCOUNTING: 'Accounting',
  AIRLINES_AVIATION: 'Airlines/Aviation',
  ALTERNATIVE_DISPUTE_RESOLUTION: 'Alternative Dispute Resolution',
  ALTERNATIVE_MEDICINE: 'Alternative Medicine',
  ANIMATION: 'Animation',
  APPAREL_FASHION: 'Apparel & Fashion',
  ARCHITECTURE_PLANNING: 'Architecture & Planning',
  ARTS_AND_CRAFTS: 'Arts and Crafts',
  AUTOMOTIVE: 'Automotive',
  AVIATION_AEROSPACE: 'Aviation & Aerospace',
  BANKING: 'Banking',
  BIOTECHNOLOGY: 'Biotechnology',
  BROADCAST_MEDIA: 'Broadcast Media',
  BUILDING_MATERIALS: 'Building Materials',
  BUSINESS_SUPPLIES_AND_EQUIPMENT: 'Business Supplies and Equipment',
  CAPITAL_MARKETS: 'Capital Markets',
  CHEMICALS: 'Chemicals',
  CIVIC_SOCIAL_ORGANIZATION: 'Civic & Social Organization',
  CIVIL_ENGINEERING: 'Civil Engineering',
  COMMERCIAL_REAL_ESTATE: 'Commercial Real Estate',
  COMPUTER_NETWORK_SECURITY: 'Computer & Network Security',
  COMPUTER_GAMES: 'Computer Games',
  COMPUTER_HARDWARE: 'Computer Hardware',
  COMPUTER_NETWORKING: 'Computer Networking',
  COMPUTER_SOFTWARE: 'Computer Software',
  CONSTRUCTION: 'Construction',
  CONSUMER_ELECTRONICS: 'Consumer Electronics',
  CONSUMER_GOODS: 'Consumer Goods',
  CONSUMER_SERVICES: 'Consumer Services',
  COSMETICS: 'Cosmetics',
  DAIRY: 'Dairy',
  DEFENSE_SPACE: 'Defense & Space',
  DESIGN: 'Design',
  EDUCATION_MANAGEMENT: 'Education Management',
  E_LEARNING: 'E-Learning',
  ELECTRICAL_ELECTRONIC_MANUFACTURING: 'Electrical/Electronic Manufacturing',
  ENTERTAINMENT: 'Entertainment',
  ENVIRONMENTAL_SERVICES: 'Environmental Services',
  EVENTS_SERVICES: 'Events Services',
  EXECUTIVE_OFFICE: 'Executive Office',
  FACILITIES_SERVICES: 'Facilities Services',
  FARMING: 'Farming',
  FINANCIAL_SERVICES: 'Financial Services',
  FINE_ART: 'Fine Art',
  FISHERY: 'Fishery',
  FOOD_BEVERAGES: 'Food & Beverages',
  FOOD_PRODUCTION: 'Food Production',
  FUND_RAISING: 'Fund-Raising',
  FURNITURE: 'Furniture',
  GAMBLING_CASINOS: 'Gambling & Casinos',
  GLASS_CERAMICS_CONCRETE: 'Glass, Ceramics & Concrete',
  GOVERNMENT_ADMINISTRATION: 'Government Administration',
  GOVERNMENT_RELATIONS: 'Government Relations',
  GRAPHIC_DESIGN: 'Graphic Design',
  HEALTH_WELLNESS_AND_FITNESS: 'Health, Wellness and Fitness',
  HIGHER_EDUCATION: 'Higher Education',
  HOSPITAL_HEALTH_CARE: 'Healthcare',
  HOSPITALITY: 'Hospitality',
  HUMAN_RESOURCES: 'Human Resources',
  IMPORT_AND_EXPORT: 'Import and Export',
  INDIVIDUAL_FAMILY_SERVICES: 'Individual & Family Services',
  INDUSTRIAL_AUTOMATION: 'Industrial Automation',
  INFORMATION_SERVICES: 'Information Services',
  INFORMATION_TECHNOLOGY_AND_SERVICES: 'Information Technology and Services',
  INSURANCE: 'Insurance',
  INTERNATIONAL_AFFAIRS: 'International Affairs',
  INTERNATIONAL_TRADE_AND_DEVELOPMENT: 'International Trade and Development',
  INTERNET: 'Internet',
  INVESTMENT_BANKING: 'Investment Banking',
  INVESTMENT_MANAGEMENT: 'Investment Management',
  JUDICIARY: 'Judiciary',
  LAW_ENFORCEMENT: 'Law Enforcement',
  LAW_PRACTICE: 'Law Practice',
  LEGAL_SERVICES: 'Legal Services',
  LEGISLATIVE_OFFICE: 'Legislative Office',
  LEISURE_TRAVEL_TOURISM: 'Leisure, Travel & Tourism',
  LIBRARIES: 'Libraries',
  LOGISTICS_AND_SUPPLY_CHAIN: 'Logistics and Supply Chain',
  LUXURY_GOODS_JEWELRY: 'Luxury Goods & Jewelry',
  MACHINERY: 'Machinery',
  MANAGEMENT_CONSULTING: 'Management Consulting',
  MARITIME: 'Maritime',
  MARKET_RESEARCH: 'Market Research',
  MARKETING_AND_ADVERTISING: 'Marketing and Advertising',
  MECHANICAL_OR_INDUSTRIAL_ENGINEERING: 'Mechanical or Industrial Engineering',
  MEDIA_PRODUCTION: 'Media Production',
  MEDICAL_DEVICES: 'Medical Devices',
  MEDICAL_PRACTICE: 'Medical Practice',
  MENTAL_HEALTH_CARE: 'Mental Health Care',
  MILITARY: 'Military',
  MINING_METALS: 'Mining & Metals',
  MOTION_PICTURES_AND_FILM: 'Motion Pictures and Film',
  MUSEUMS_AND_INSTITUTIONS: 'Museums and Institutions',
  MUSIC: 'Music',
  NANOTECHNOLOGY: 'Nanotechnology',
  NEWSPAPERS: 'Newspapers',
  NONPROFIT_ORGANIZATION_MANAGEMENT: 'Nonprofit Organization Management',
  OIL_ENERGY: 'Oil & Energy',
  ONLINE_MEDIA: 'Online Media',
  OUTSOURCING_OFFSHORING: 'Outsourcing/Offshoring',
  PACKAGE_FREIGHT_DELIVERY: 'Package/Freight Delivery',
  PACKAGING_AND_CONTAINERS: 'Packaging and Containers',
  PAPER_FOREST_PRODUCTS: 'Paper & Forest Products',
  PERFORMING_ARTS: 'Performing Arts',
  PHARMACEUTICALS: 'Pharmaceuticals',
  PHILANTHROPY: 'Philanthropy',
  PHOTOGRAPHY: 'Photography',
  PLASTICS: 'Plastics',
  POLITICAL_ORGANIZATION: 'Political Organization',
  PRIMARY_SECONDARY_EDUCATION: 'Primary/Secondary Education',
  PRINTING: 'Printing',
  PROFESSIONAL_TRAINING_COACHING: 'Professional Training & Coaching',
  PROGRAM_DEVELOPMENT: 'Program Development',
  PUBLIC_POLICY: 'Public Policy',
  PUBLIC_RELATIONS_AND_COMMUNICATIONS: 'Public Relations and Communications',
  PUBLIC_SAFETY: 'Public Safety',
  PUBLISHING: 'Publishing',
  RAILROAD_MANUFACTURE: 'Railroad Manufacture',
  RANCHING: 'Ranching',
  REAL_ESTATE: 'Real Estate',
  RECREATIONAL_FACILITIES_AND_SERVICES: 'Recreational Facilities and Services',
  RELIGIOUS_INSTITUTIONS: 'Religious Institutions',
  RENEWABLES_ENVIRONMENT: 'Renewables & Environment',
  RESEARCH: 'Research',
  RESTAURANTS: 'Restaurants',
  RETAIL: 'Retail',
  SECURITY_AND_INVESTIGATIONS: 'Security and Investigations',
  SEMICONDUCTORS: 'Semiconductors',
  SHIPBUILDING: 'Shipbuilding',
  SPORTING_GOODS: 'Sporting Goods',
  SPORTS: 'Sports',
  STAFFING_AND_RECRUITING: 'Staffing and Recruiting',
  SUPERMARKETS: 'Supermarkets',
  TELECOMMUNICATIONS: 'Telecommunications',
  TEXTILES: 'Textiles',
  THINK_TANKS: 'Think Tanks',
  TOBACCO: 'Tobacco',
  TRANSLATION_AND_LOCALIZATION: 'Translation and Localization',
  TRANSPORTATION_TRUCKING_RAILROAD: 'Transportation/Trucking/Railroad',
  UTILITIES: 'Utilities',
  VENTURE_CAPITAL_PRIVATE_EQUITY: 'Venture Capital & Private Equity',
  VETERINARY: 'Veterinary',
  WAREHOUSING: 'Warehousing',
  WHOLESALE: 'Wholesale',
  WINE_AND_SPIRITS: 'Wine and Spirits',
  WIRELESS: 'Wireless',
  WRITING_AND_EDITING: 'Writing and Editing',
};

/**
 * Apply industry normalization to a record.
 */
function normalizeIndustry(record: RawRecord): RawRecord {
  const industry = record.industry as string | undefined;
  if (!industry) return record;

  // Normalize the industry value
  const normalized = HUBSPOT_INDUSTRY_MAP[industry] || industry;

  return {
    ...record,
    industry: normalized,
  };
}

// ─────────────────────────────────────────────────────────────
// Diff Output Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Truncate a string to maxLen characters, adding ... if truncated.
 */
function truncate(value: unknown, maxLen: number = 40): string {
  if (value === null || value === undefined || value === '') {
    return '[blank]';
  }
  const str = String(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Pad a string to a fixed width.
 */
function pad(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * Format a single field decision as a diff line.
 */
function formatFieldDiff(
  decision: FieldWriteDecision,
  fieldNameWidth: number,
  valueWidth: number
): string {
  const fieldName = pad(decision.fieldName, fieldNameWidth);
  const current = pad(truncate(decision.currentValue, valueWidth), valueWidth);
  const proposed = pad(truncate(decision.translatedValue || decision.newValue, valueWidth), valueWidth);

  let status: string;
  if (decision.action === 'write') {
    status = 'WRITE';
  } else if (decision.reason === 'enum_mismatch') {
    status = 'BLOCKED (enum_mismatch)';
  } else {
    status = `SKIP (${decision.reason})`;
  }

  return `    ${fieldName}  ${current}  →  ${proposed}  ${status}`;
}

/**
 * Print diff output for a single record.
 */
function printRecordDiff(
  record: RecordWriteResult,
  normalizedRecords: RawRecord[],
  fieldNameWidth: number = 14,
  valueWidth: number = 22
): { writes: number; blocked: number; unchanged: number } {
  const name = normalizedRecords.find(n => n._id === record.recordId)?.name || record.recordId;
  const hubspotId = record.hubspotId || 'new';

  console.log(`\n  ${name}  (${hubspotId})`);

  // Combine all field decisions
  const allDecisions = [...record.fieldsUpdated, ...record.fieldsSkipped];

  // Separate into actionable (WRITE or BLOCKED) and unchanged
  const actionable: FieldWriteDecision[] = [];
  const unchanged: FieldWriteDecision[] = [];

  for (const d of allDecisions) {
    if (d.action === 'write') {
      actionable.push(d);
    } else if (d.reason === 'enum_mismatch') {
      actionable.push(d); // Show blocked writes
    } else if (d.reason === 'no_change' || d.newValue === undefined) {
      unchanged.push(d);
    } else {
      // Other skip reasons (never_overwrite, hubspot_has_different_value)
      // Only show if there was a proposed value
      if (d.newValue !== undefined && d.newValue !== null && d.newValue !== '') {
        actionable.push(d);
      } else {
        unchanged.push(d);
      }
    }
  }

  // Print actionable fields
  for (const d of actionable) {
    console.log(formatFieldDiff(d, fieldNameWidth, valueWidth));
  }

  // Print unchanged count
  if (unchanged.length > 0) {
    console.log(`    (${unchanged.length} fields unchanged)`);
  }

  return {
    writes: actionable.filter(d => d.action === 'write').length,
    blocked: actionable.filter(d => d.reason === 'enum_mismatch').length,
    unchanged: unchanged.length,
  };
}

/**
 * Print summary block after all records.
 */
function printSummary(
  totalRecords: number,
  totalWrites: number,
  totalBlocked: number,
  totalUnchanged: number,
  dedupSummary: string
): void {
  console.log('\n─────────────────────────────────────────');
  console.log(`Records processed:   ${totalRecords}`);
  console.log(`Fields to write:     ${totalWrites}`);
  console.log(`Fields blocked:      ${totalBlocked.toString().padEnd(4)} (enum_mismatch)`);
  console.log(`Fields unchanged:    ${totalUnchanged}`);
  console.log(`Dedup: ${dedupSummary}`);
}

async function main() {
  console.log('🔄 HubSpot H2 Write Path Validation\n');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no actual writes)' : '✍️  LIVE WRITE'}\n`);

  // Step 1: Validate token
  console.log('1️⃣  Validating token...');
  const validation = await validateToken(token!);

  if (!validation.valid) {
    console.error(`❌ Token validation failed: ${validation.error}`);
    process.exit(1);
  }

  console.log(`✅ Token valid`);
  console.log(`   Portal ID: ${validation.portalId}\n`);

  // Step 2: Create client and fetch companies
  console.log('2️⃣  Fetching companies...');
  const client = new HubSpotClient(token!, validation.portalId!);

  const companies: HubSpotCompany[] = [];

  try {
    // Pull companies
    for await (const batch of client.getAllCompanies()) {
      companies.push(...batch);
      if (companies.length >= 100) break;
    }

    const finalCompanies = companies.slice(0, 100); // Ensure exactly 100 max
    console.log(`✅ Fetched ${finalCompanies.length} companies\n`);

    // Step 3: Map to canonical format
    console.log('3️⃣  Mapping to canonical format...');
    const rawRecords = hubspotToRawRecords(finalCompanies, defaultMappings);
    console.log(`✅ Mapped ${rawRecords.length} records\n`);

    // Step 4: Apply industry normalization
    console.log('4️⃣  Applying industry normalization...');
    const normalizedRecords = rawRecords.map(normalizeIndustry);

    // Count how many industries were normalized
    let normalizedCount = 0;
    const industryChanges: Array<{ name: string; before: string; after: string }> = [];

    for (let i = 0; i < rawRecords.length; i++) {
      const before = rawRecords[i].industry as string | undefined;
      const after = normalizedRecords[i].industry as string | undefined;

      if (before && after && before !== after) {
        normalizedCount++;
        if (industryChanges.length < 10) {
          industryChanges.push({
            name: (rawRecords[i].name as string) || rawRecords[i]._id,
            before,
            after,
          });
        }
      }
    }

    console.log(`✅ Normalized ${normalizedCount} industry values`);
    if (industryChanges.length > 0) {
      console.log('   Sample changes:');
      for (const change of industryChanges) {
        console.log(`   - ${change.name}: ${change.before} → ${change.after}`);
      }
    }
    console.log();

    // Step 5: Execute write
    console.log(`5️⃣  ${dryRun ? 'Simulating' : 'Executing'} batch write...`);
    console.log('   (Building company index for O(1) dedup lookups...)\n');

    const result = await executeBatchWrite(
      { records: normalizedRecords, dryRun },
      client,
      defaultMappings
    );

    // Step 6: Report results
    if (dryRun) {
      // Dry run: Show detailed before/after diff for every record
      console.log('='.repeat(60));
      console.log('📊 Dry Run Diff - Before/After for Each Record');
      console.log('='.repeat(60));

      let totalWrites = 0;
      let totalBlocked = 0;
      let totalUnchanged = 0;

      // Process all records
      for (const record of result.results) {
        const stats = printRecordDiff(record, normalizedRecords);
        totalWrites += stats.writes;
        totalBlocked += stats.blocked;
        totalUnchanged += stats.unchanged;
      }

      // Determine dedup summary
      const upsertCount = result.results.filter(r => r.dedupOutcome.action === 'upsert').length;
      const insertCount = result.results.filter(r => r.dedupOutcome.action === 'insert').length;
      const reviewCount = result.results.filter(r => r.dedupOutcome.action === 'review').length;

      let dedupSummary: string;
      if (upsertCount === result.total) {
        dedupSummary = 'all routed to upsert via _hubspot_id';
      } else if (insertCount > 0 || reviewCount > 0) {
        dedupSummary = `${upsertCount} upsert, ${insertCount} insert, ${reviewCount} review`;
      } else {
        dedupSummary = `${upsertCount} upsert`;
      }

      printSummary(result.total, totalWrites, totalBlocked, totalUnchanged, dedupSummary);

      // Index stats (compact)
      if (result.indexStats) {
        console.log(`Index: ${result.indexStats.totalCompanies} companies, ${result.indexStats.companiesWithParent} with parent`);
      }

      console.log(`Timing: ${result.timing.totalMs}ms total`);
    } else {
      // Live write: Show standard results
      console.log('='.repeat(60));
      console.log('📊 Write Results\n');

      console.log(`Total processed: ${result.total}`);
      console.log(`   Created: ${result.created}`);
      console.log(`   Updated: ${result.updated}`);
      console.log(`   Skipped: ${result.skipped}`);
      console.log(`   Queued for review: ${result.queuedForReview}`);
      console.log(`   Errors: ${result.errors}`);
      console.log();

      // Index stats
      if (result.indexStats) {
        console.log('🏢 Company Index Stats');
        console.log(`   Total companies in portal: ${result.indexStats.totalCompanies}`);
        console.log(`   Companies with parent associations: ${result.indexStats.companiesWithParent}`);
        console.log(`   Parent-child pairs detected: ${result.indexStats.parentChildPairsDetected}`);
        console.log(`   Suppressions created: ${result.indexStats.suppressionsCreated}`);
        console.log();
      }

      console.log('⏱️  Timing');
      console.log(`   Dedup check (incl. index build): ${result.timing.dedupCheckMs}ms`);
      console.log(`   Write: ${result.timing.writeMs}ms`);
      console.log(`   Total: ${result.timing.totalMs}ms`);
      console.log();

      // Show sample field decisions
      const updatedRecords = result.results.filter(r => r.action === 'updated' || r.action === 'created');
      if (updatedRecords.length > 0) {
        console.log('📝 Sample Field Decisions (first 3 updated records):\n');

        for (const record of updatedRecords.slice(0, 3)) {
          const name = normalizedRecords.find(n => n._id === record.recordId)?.name || record.recordId;
          console.log(`   Record: ${name}`);
          console.log(`   Action: ${record.action}`);
          console.log(`   HubSpot ID: ${record.hubspotId || 'N/A'}`);

          if (record.fieldsUpdated.length > 0) {
            console.log('   Fields updated:');
            for (const field of record.fieldsUpdated) {
              console.log(`     - ${field.fieldName}: ${field.currentValue || '(blank)'} → ${field.newValue}`);
            }
          }

          if (record.fieldsSkipped.length > 0) {
            const skipReasons = record.fieldsSkipped.map(f => `${f.fieldName}:${f.reason}`);
            console.log(`   Fields skipped: ${skipReasons.slice(0, 5).join(', ')}${skipReasons.length > 5 ? '...' : ''}`);
          }

          if (record.dedupOutcome.warning) {
            console.log(`   ⚠️  Warning: ${record.dedupOutcome.warning}`);
          }

          console.log();
        }
      }

      // Show dedup outcomes
      const reviewItems = result.results.filter(r => r.action === 'queued_for_review');
      if (reviewItems.length > 0) {
        console.log('🔍 Records Queued for Review:\n');
        for (const item of reviewItems.slice(0, 5)) {
          const name = normalizedRecords.find(n => n._id === item.recordId)?.name || item.recordId;
          console.log(`   - ${name}`);
          console.log(`     Similarity: ${((item.dedupOutcome.similarityScore || 0) * 100).toFixed(0)}%`);
          console.log(`     Matched HubSpot ID: ${item.dedupOutcome.targetHubSpotId}`);
        }
        if (reviewItems.length > 5) {
          console.log(`   ... and ${reviewItems.length - 5} more`);
        }
        console.log();
      }

      // Show errors
      const errorRecords = result.results.filter(r => r.action === 'error');
      if (errorRecords.length > 0) {
        console.log('❌ Errors:\n');
        for (const record of errorRecords.slice(0, 5)) {
          const name = normalizedRecords.find(n => n._id === record.recordId)?.name || record.recordId;
          console.log(`   - ${name}: ${record.error}`);
        }
        if (errorRecords.length > 5) {
          console.log(`   ... and ${errorRecords.length - 5} more`);
        }
        console.log();
      }

      console.log('='.repeat(60));
      console.log(`\n✅ H2 Write Validation Complete!`);
      console.log(`   Mode: Live Write`);
      console.log(`   Portal: ${validation.portalId}`);
      console.log(`   Records processed: ${result.total}`);
      console.log(`   Records written: ${result.created + result.updated}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

main().catch(console.error);
