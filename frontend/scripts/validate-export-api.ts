#!/usr/bin/env npx tsx
/**
 * Validate Export API
 *
 * One-off script to test Export API against Frontera's portal.
 * Confirms the actual format HubSpot returns.
 *
 * Usage:
 *   HUBSPOT_TOKEN=pat-na1-xxx npx tsx scripts/validate-export-api.ts
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150;

// Only fetch minimal properties for test
const TEST_PROPERTIES = ['hs_object_id', 'name', 'domain'];

async function main() {
  const token = process.env.HUBSPOT_TOKEN;

  if (!token) {
    console.error('Error: HUBSPOT_TOKEN environment variable required');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Export API Validation Script');
  console.log('='.repeat(60));

  // 1. Validate token and get portal ID
  console.log('\n[1/5] Validating token...');
  const accountResponse = await fetch(`${HUBSPOT_API_BASE}/account-info/v3/details`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!accountResponse.ok) {
    console.error(`Token validation failed: ${accountResponse.status}`);
    process.exit(1);
  }

  const accountData = await accountResponse.json();
  const portalId = accountData.portalId;
  console.log(`   Portal ID: ${portalId}`);

  // 2. Check Export API access by attempting to trigger an export
  console.log('\n[2/5] Checking Export API access...');
  // Skip pre-check - we'll verify access by triggering the export directly
  console.log('   Will verify access by triggering export');

  // 3. Trigger export job
  console.log('\n[3/5] Triggering export job...');
  console.log(`   Properties: ${TEST_PROPERTIES.join(', ')}`);

  const exportRequest = {
    exportType: 'VIEW',   // VIEW exports all objects without needing a list ID
    format: 'CSV',        // HubSpot Export API only supports CSV format
    exportName: `validation-test-${Date.now()}`,
    objectType: 'COMPANY',
    objectProperties: TEST_PROPERTIES,
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
    console.error(`Export trigger failed: ${triggerResponse.status}`);
    console.error(errorBody);
    process.exit(1);
  }

  const triggerData = await triggerResponse.json();
  const taskId = triggerData.id;
  console.log(`   Export job created: ${taskId}`);
  console.log(`   Initial status: ${triggerData.status}`);

  // 4. Poll for completion using /status endpoint
  console.log('\n[4/5] Polling for completion...');
  let status = 'PENDING';
  let downloadUrl: string | null = null;
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;

    const pollResponse = await fetch(`${HUBSPOT_API_BASE}/crm/v3/exports/export/async/tasks/${taskId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollResponse.ok) {
      console.error(`   Poll failed: ${pollResponse.status}`);
      const errorBody = await pollResponse.text();
      console.error(`   Response: ${errorBody.substring(0, 200)}`);
      process.exit(1);
    }

    const pollData = await pollResponse.json();
    status = pollData.status;
    downloadUrl = pollData.result || null;

    if (status === 'COMPLETE') {
      break;
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      console.error(`   Export failed with status: ${status}`);
      process.exit(1);
    }

    if (attempts % 5 === 0) {
      console.log(`   Attempt ${attempts}: status=${status}`);
    }
  }

  if (status !== 'COMPLETE' || !downloadUrl) {
    console.error(`   Export timed out or missing download URL. Status: ${status}`);
    process.exit(1);
  }

  console.log(`   Export complete after ${attempts} poll(s)`);
  console.log(`   Download URL: ${downloadUrl.substring(0, 80)}...`);

  // 5. Download and analyze file
  console.log('\n[5/5] Downloading and analyzing file...');
  const downloadResponse = await fetch(downloadUrl);

  if (!downloadResponse.ok) {
    console.error(`   Download failed: ${downloadResponse.status}`);
    process.exit(1);
  }

  const rawContent = await downloadResponse.text();

  console.log('\n' + '='.repeat(60));
  console.log('RAW FILE CONTENT (first 500 chars):');
  console.log('='.repeat(60));
  console.log(rawContent.substring(0, 500));
  if (rawContent.length > 500) {
    console.log(`... (${rawContent.length - 500} more characters)`);
  }
  console.log('='.repeat(60));

  // Parse CSV format
  const trimmed = rawContent.trim();
  const lines = trimmed.split('\n');
  const headers = parseCSVLine(lines[0]);

  console.log(`\nDetected format: CSV`);
  console.log(`Headers: ${headers.join(', ')}`);
  console.log(`Total data rows: ${lines.length - 1}`);

  // Parse data rows into objects
  const parsedRecords: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || '';
    }
    parsedRecords.push(record);
  }

  // Show first 3 parsed records
  console.log('\n' + '='.repeat(60));
  console.log('FIRST 3 PARSED COMPANY OBJECTS:');
  console.log('='.repeat(60));

  const first3 = parsedRecords.slice(0, 3);
  for (let i = 0; i < first3.length; i++) {
    console.log(`\n[Company ${i + 1}]`);
    console.log(JSON.stringify(first3[i], null, 2));
  }

  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(60));
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
