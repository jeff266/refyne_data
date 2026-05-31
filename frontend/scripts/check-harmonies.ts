import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkHarmonies() {
  console.log('Checking harmonies...\n');

  const { data, error } = await supabase
    .from('harmonies')
    .select('id, name, field, object_type, is_active')
    .order('object_type', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${data.length} harmonies:\n`);

  const byObject = {
    company: data.filter(h => h.object_type === 'company'),
    contact: data.filter(h => h.object_type === 'contact')
  };

  console.log('Company harmonies:');
  byObject.company.forEach(h => {
    const status = h.is_active ? '✅' : '❌';
    console.log(`  ${status} ${h.id.padEnd(30)} ${h.name.padEnd(40)} field: ${h.field}`);
  });

  console.log('\nContact harmonies:');
  byObject.contact.forEach(h => {
    const status = h.is_active ? '✅' : '❌';
    console.log(`  ${status} ${h.id.padEnd(30)} ${h.name.padEnd(40)} field: ${h.field}`);
  });

  // Check for phone-related harmonies
  console.log('\n\nPhone-related harmonies:');
  const phoneHarmonies = data.filter(h => h.id.includes('phone') || h.field.includes('phone'));
  phoneHarmonies.forEach(h => {
    const status = h.is_active ? '✅' : '❌';
    console.log(`  ${status} ${h.id.padEnd(30)} ${h.name.padEnd(40)} object: ${h.object_type}, field: ${h.field}`);
  });
}

checkHarmonies().catch(console.error);
