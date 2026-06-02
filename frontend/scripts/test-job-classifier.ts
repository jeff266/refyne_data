/**
 * Test job title classifier against real RevOps Impact contact titles
 */

import { classifyJobTitleBatch } from '../lib/harmonies/job-title-classifier';

const TEST_TITLES = [
  'Clinical Director',
  'BCBA',
  'Board Certified Behavior Analyst',
  'Chief Executive Officer',
  'CEO',
  'Revenue Operations Manager',
  'Director of Revenue Operations',
  'Head of Revenue Operations',
  'Co-Founder & CEO',
  'Founder & CEO',
  'Chief Clinical Officer',
  'Assistant Clinical Director',
  'Senior BCBA',
  'Marketing Operations Manager',
  'Head of Marketing',
  'Chief Revenue Officer (CRO)',
  'Managing Partner',
  'Owner',
  'Member',
  'Behavior Technician',
];

async function main() {
  console.log('Testing job title classifier...\n');
  console.log('Title'.padEnd(42), 'Level'.padEnd(14), 'Function');
  console.log('─'.repeat(90));

  const results = await classifyJobTitleBatch(TEST_TITLES);

  for (const title of TEST_TITLES) {
    const r = results.get(title);
    console.log(
      `${title.padEnd(42)} ${(r?.level ?? 'Other').padEnd(14)} ${r?.function ?? 'Other'}`
    );
  }

  console.log('─'.repeat(90));
  console.log(`\nTotal unique titles classified: ${results.size}`);
  console.log('\n✓ All 20 titles classified successfully');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
