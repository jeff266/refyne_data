import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data, error } = await supabase
    .from('harmony_reference_data')
    .select('table_name')
    .in('table_name', ['contact_titles', 'us_states']);

  if (error) {
    console.error('Error:', error);
  } else {
    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.table_name] = (counts[row.table_name] || 0) + 1;
    }
    console.log('Counts by table_name:');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table}: ${count} rows`);
    }
  }
}

verify();
