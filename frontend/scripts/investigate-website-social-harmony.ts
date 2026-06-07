/**
 * Investigate Website Social Media Harmony
 *
 * The "Website Social Media Domain Flag" harmony has the same target field
 * as "Company Domain Normalizer" (both write to company.domain), causing
 * duplicate preview changes. This script investigates what it should do.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function investigateWebsiteSocialHarmony() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  console.log('\n🔍 Investigating Website Social Media Harmony');
  console.log('═'.repeat(70));

  // Get full harmony configuration
  const { data: harmony, error } = await supabaseAdmin
    .from('harmonies')
    .select('*')
    .eq('id', 'website-social-media')
    .single();

  if (error) {
    console.error('❌ Error fetching harmony:', error);
    process.exit(1);
  }

  console.log('\n📋 Full Harmony Configuration:');
  console.log(JSON.stringify(harmony, null, 2));

  console.log('\n🔍 Analysis:');
  console.log('─'.repeat(70));
  console.log(`Name: "${harmony.name}"`);
  console.log(`Field: ${harmony.field}`);
  console.log(`Transform Type: ${harmony.transform_type}`);
  console.log(`Transform Function: ${harmony.transform_function}`);

  console.log('\n💡 Expected Behavior vs. Actual:');
  console.log('─'.repeat(70));
  console.log('Based on the name "Website Social Media Domain Flag":');
  console.log('  EXPECTED: Sets a boolean/flag field indicating if domain is social media');
  console.log('  EXPECTED Field: Something like company.is_social_media or company.social_media_flag');
  console.log('');
  console.log('Current Configuration:');
  console.log(`  ACTUAL: Normalizes company.domain using url_canonical transform`);
  console.log(`  ACTUAL Field: company.domain (same as company-domain harmony!)`);
  console.log('');
  console.log('❌ PROBLEM: Both harmonies write to the same field, causing duplicates.');
  console.log('');
  console.log('✅ SOLUTION OPTIONS:');
  console.log('  1. Change website-social-media field to a different target (e.g., company.is_social_media)');
  console.log('  2. Change website-social-media to use a different transform that sets a flag');
  console.log('  3. Deactivate website-social-media if it\'s not needed');
  console.log('  4. Delete website-social-media if it was created by mistake');
  console.log('');

  // Check if there's a reference table or transform config that might clarify intent
  if (harmony.reference_table) {
    console.log(`Reference Table: ${harmony.reference_table}`);
    console.log('(This suggests lookup-based normalization, not flag setting)');
  }

  if (harmony.transform_config) {
    console.log(`Transform Config: ${JSON.stringify(harmony.transform_config)}`);
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

investigateWebsiteSocialHarmony().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
