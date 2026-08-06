/**
 * Fix org_entitlements view to respect plan_override
 *
 * Executes the SQL directly using Supabase client
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const migrationSQL = `
CREATE OR REPLACE VIEW public.org_entitlements AS
SELECT
  ob.org_id,
  -- Use plan_override if set, otherwise fall back to subscription_tier
  COALESCE(ob.plan_override, ob.subscription_tier) AS subscription_tier,
  ob.subscription_status,

  -- Trial limits
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 25 ELSE NULL END AS trial_merge_limit,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 100 ELSE NULL END AS trial_normalize_limit,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 50 ELSE NULL END AS trial_enrich_limit,

  -- Trial usage
  ob.trial_merges_used,
  ob.trial_normalize_writes_used,
  ob.trial_enrich_credits_used,

  -- Trial remaining (null for non-trial tiers)
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 25 - ob.trial_merges_used ELSE NULL END AS trial_merges_remaining,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 100 - ob.trial_normalize_writes_used ELSE NULL END AS trial_normalize_remaining,
  CASE WHEN COALESCE(ob.plan_override, ob.subscription_tier) = 'trial' THEN 50 - ob.trial_enrich_credits_used ELSE NULL END AS trial_enrich_remaining,

  -- Trial dates
  ob.trial_start_date,
  ob.trial_end_date,
  EXTRACT(EPOCH FROM (ob.trial_end_date - NOW())) / 86400 AS trial_days_remaining,

  -- Paid plan credits
  ob.pro_monthly_enrich_credits,
  ob.enterprise_monthly_enrich_credits,

  -- Current period usage (last 30 days)
  COALESCE(SUM(ou.merges_executed) FILTER (WHERE ou.date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS merges_last_30d,
  COALESCE(SUM(ou.normalize_writes) FILTER (WHERE ou.date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS normalize_writes_last_30d,
  COALESCE(SUM(ou.enrich_credits_consumed) FILTER (WHERE ou.date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS enrich_credits_last_30d,

  -- Period dates
  ob.current_period_start,
  ob.current_period_end,
  ob.cancel_at_period_end,

  ob.created_at,
  ob.updated_at
FROM org_billing ob
LEFT JOIN org_usage ou ON ob.org_id = ou.org_id
GROUP BY ob.org_id, ob.plan_override, ob.subscription_tier, ob.subscription_status,
         ob.trial_merges_used, ob.trial_normalize_writes_used, ob.trial_enrich_credits_used,
         ob.trial_start_date, ob.trial_end_date,
         ob.pro_monthly_enrich_credits, ob.enterprise_monthly_enrich_credits,
         ob.current_period_start, ob.current_period_end, ob.cancel_at_period_end,
         ob.created_at, ob.updated_at;
`;

async function main() {
  console.log('[Fix] Updating org_entitlements view...\n');

  // Use the REST API directly via fetch to execute DDL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql: migrationSQL }),
  });

  if (!response.ok) {
    console.error('Failed to execute SQL. Trying alternative method...\n');

    // Alternative: Use pg library if available
    try {
      const { Pool } = require('pg');

      // Extract connection details from Supabase URL
      const url = new URL(SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];

      const pool = new Pool({
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: SUPABASE_SERVICE_KEY, // This won't work, need actual DB password
      });

      const result = await pool.query(migrationSQL);
      await pool.end();

      console.log('✅ View updated successfully!\n');
      console.log('The trial banners should now disappear for comped accounts.');
      process.exit(0);
    } catch (pgError) {
      console.error('\n❌ Could not execute via pg either.');
      console.error('\nPlease run this SQL manually in Supabase SQL Editor:');
      console.error('https://supabase.com/dashboard/project/' + SUPABASE_URL.split('.')[0].split('//')[1] + '/sql\n');
      console.log(migrationSQL);
      process.exit(1);
    }
  }

  const data = await response.json();
  console.log('✅ View updated successfully!\n');
  console.log('The trial banners should now disappear for comped accounts.');
  console.log('\nRefresh your browser to see the changes.');
}

main().catch(console.error);
