/**
 * Test Worker Alert with Real Org Lookup
 *
 * Sends a worker alert using a real org ID to test name lookup.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testWorkerAlert() {
  const { sendWorkerAlert } = await import('../lib/monitoring/alert');

  console.log('\n📧 Testing Worker Alert with org name lookup...\n');

  // Use RevOps Impact org ID from CLAUDE.md
  const realOrgId = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS';

  await sendWorkerAlert(
    'Dedup scanner completed with errors',
    'The nightly dedup scan encountered 3 API rate limit errors. All retries exhausted.',
    realOrgId
  );

  console.log('✅ Worker alert sent!');
  console.log('\nShould show: "Organization: RevOps Impact"');
  console.log('(Instead of: "Org ID: org_3DuSdb0FBnx7RMLmJSUegrpiNLS")\n');
  console.log('Check jeff@revopsimpact.us\n');
}

testWorkerAlert().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
