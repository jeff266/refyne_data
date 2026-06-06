/**
 * Mark Internal Organizations
 *
 * Sets subscription_tier='internal' for Refyne team orgs.
 * Internal orgs bypass all billing limits and usage tracking.
 *
 * Run after migration 081:
 * npx tsx scripts/mark-internal-orgs.ts
 */

import { supabaseAdmin } from '../lib/db/admin-client';

// Internal org IDs (Refyne team, demo accounts, etc.)
const INTERNAL_ORG_IDS = [
  'org_3DuSdb0FBnx7RMLmJSUegrpiNLS', // RevOps Impact (Jeff's consulting org)
  // Add more internal org IDs here as needed
];

async function markInternalOrgs() {
  console.log('[Mark Internal Orgs] Starting...\n');

  for (const orgId of INTERNAL_ORG_IDS) {
    console.log(`[Mark Internal Orgs] Processing org: ${orgId}`);

    // Check if org_billing record exists
    const { data: existing } = await supabaseAdmin
      .from('org_billing')
      .select('org_id, subscription_tier')
      .eq('org_id', orgId)
      .single();

    if (existing) {
      // Update existing record
      if (existing.subscription_tier === 'internal') {
        console.log(`  ✓ Already marked as internal`);
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('org_billing')
        .update({
          subscription_tier: 'internal',
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId);

      if (updateError) {
        console.error(`  ✗ Failed to update:`, updateError);
        continue;
      }

      console.log(`  ✓ Updated from '${existing.subscription_tier}' to 'internal'`);
    } else {
      // Create new record
      const { error: insertError } = await supabaseAdmin
        .from('org_billing')
        .insert({
          org_id: orgId,
          subscription_tier: 'internal',
          subscription_status: 'active',
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now (not used for internal)
          trial_merges_used: 0,
          trial_normalize_writes_used: 0,
          trial_enrich_credits_used: 0,
        });

      if (insertError) {
        console.error(`  ✗ Failed to insert:`, insertError);
        continue;
      }

      console.log(`  ✓ Created new org_billing record as 'internal'`);
    }

    // Log billing event
    const { error: eventError } = await supabaseAdmin
      .from('org_billing_events')
      .insert({
        org_id: orgId,
        event_type: 'org_marked_internal',
        actor_id: 'system',
        metadata: {
          script: 'mark-internal-orgs.ts',
          timestamp: new Date().toISOString(),
        },
      });

    if (eventError) {
      console.warn(`  ⚠ Failed to log billing event:`, eventError);
    }
  }

  console.log('\n[Mark Internal Orgs] Complete!');
  process.exit(0);
}

// Run
markInternalOrgs().catch((err) => {
  console.error('[Mark Internal Orgs] Fatal error:', err);
  process.exit(1);
});
