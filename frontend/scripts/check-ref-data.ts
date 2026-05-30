#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://iidsjejbhdpzzmbotybb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('harmony_reference_data')
    .select('raw_value, canonical_value, org_id')
    .eq('table_name', 'industries')
    .order('raw_value')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\nReference Data (industries):');
  console.log('raw_value → canonical_value');
  console.log('─'.repeat(80));
  
  if (!data || data.length === 0) {
    console.log('(no data found)');
    
    // Check if table exists but is empty
    const { count } = await supabase
      .from('harmony_reference_data')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nTotal rows in harmony_reference_data: ${count}`);
    return;
  }

  data.forEach((row: any) => {
    const raw = (row.raw_value || '').padEnd(40);
    const canonical = row.canonical_value || '';
    console.log(`${raw} → ${canonical}`);
  });
  
  console.log(`\nTotal rows: ${data.length}`);
}

check();
