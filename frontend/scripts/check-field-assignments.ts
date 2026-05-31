import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables:');
  console.error('SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('SUPABASE_KEY:', supabaseKey ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFieldAssignments() {
  console.log('Checking global field assignments...\n');

  const { data, error } = await supabase
    .from('harmony_field_assignments')
    .select('*')
    .is('org_id', null)
    .order('canonical_field');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${data.length} global assignments:\n`);

  const byObject = {
    company: data.filter(a => a.object_type === 'company'),
    contact: data.filter(a => a.object_type === 'contact')
  };

  console.log('Company assignments:');
  byObject.company.forEach(a => {
    console.log(`  ${a.canonical_field.padEnd(30)} -> ${a.hubspot_property.padEnd(25)} (${a.harmony_id})`);
  });

  console.log('\nContact assignments:');
  byObject.contact.forEach(a => {
    console.log(`  ${a.canonical_field.padEnd(30)} -> ${a.hubspot_property.padEnd(25)} (${a.harmony_id})`);
  });

  // Check specific harmonies mentioned in the screenshot
  const targetHarmonies = ['company-name', 'company-industry', 'phone-e164', 'linkedin-url', 'person-title', 'person-name'];

  console.log('\n\nTarget harmonies from screenshot:');
  for (const harmonyId of targetHarmonies) {
    const assignments = data.filter(a => a.harmony_id === harmonyId);
    if (assignments.length === 0) {
      console.log(`  ❌ ${harmonyId} - NO ASSIGNMENTS FOUND`);
    } else {
      assignments.forEach(a => {
        console.log(`  ✅ ${harmonyId.padEnd(20)} -> ${a.canonical_field.padEnd(30)} -> ${a.hubspot_property}`);
      });
    }
  }
}

checkFieldAssignments().catch(console.error);
