/**
 * Trial Counter RPC Tests
 *
 * Tests increment_trial_counter() RPC function with real database calls.
 * Uses service role client to bypass RLS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin } from '@/lib/db/admin-client';

describe('increment_trial_counter RPC', () => {
  let testOrgId: string;

  beforeAll(async () => {
    // Create unique test org ID
    testOrgId = `test-billing-org-${Date.now()}`;

    // Insert test row into org_billing
    const { error } = await supabaseAdmin.from('org_billing').insert({
      org_id: testOrgId,
      subscription_tier: 'trial',
      subscription_status: 'active',
      trial_merges_used: 0,
      trial_normalize_writes_used: 0,
      trial_enrich_credits_used: 0,
    });

    if (error) {
      throw new Error(`Failed to create test org_billing: ${error.message}`);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabaseAdmin.from('org_billing').delete().eq('org_id', testOrgId);
  });

  it('increments merge counter', async () => {
    // Call RPC to increment
    const { data: success, error } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'merges',
      p_increment: 1,
    });

    expect(error).toBeNull();
    expect(success).toBe(true);

    // Verify counter was incremented
    const { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('trial_merges_used')
      .eq('org_id', testOrgId)
      .single();

    expect(billing?.trial_merges_used).toBe(1);
  });

  it('blocks at merge limit (25)', async () => {
    // Set counter to 24
    await supabaseAdmin
      .from('org_billing')
      .update({ trial_merges_used: 24 })
      .eq('org_id', testOrgId);

    // Increment to 25 - should succeed
    const { data: success1 } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'merges',
      p_increment: 1,
    });

    expect(success1).toBe(true);

    // Try to increment to 26 - should fail
    const { data: success2 } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'merges',
      p_increment: 1,
    });

    expect(success2).toBe(false);

    // Verify counter stayed at 25
    const { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('trial_merges_used')
      .eq('org_id', testOrgId)
      .single();

    expect(billing?.trial_merges_used).toBe(25);
  });

  it('blocks when increment would exceed limit', async () => {
    // Set counter to 24
    await supabaseAdmin
      .from('org_billing')
      .update({ trial_merges_used: 24 })
      .eq('org_id', testOrgId);

    // Try to increment by 2 (would go to 26) - should fail
    const { data: success } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'merges',
      p_increment: 2,
    });

    expect(success).toBe(false);

    // Verify counter stayed at 24
    const { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('trial_merges_used')
      .eq('org_id', testOrgId)
      .single();

    expect(billing?.trial_merges_used).toBe(24);
  });

  it('normalize_writes limit is 100', async () => {
    // Set counter to 99
    await supabaseAdmin
      .from('org_billing')
      .update({ trial_normalize_writes_used: 99 })
      .eq('org_id', testOrgId);

    // Increment to 100 - should succeed
    const { data: success1 } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'normalize_writes',
      p_increment: 1,
    });

    expect(success1).toBe(true);

    // Try to increment to 101 - should fail
    const { data: success2 } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'normalize_writes',
      p_increment: 1,
    });

    expect(success2).toBe(false);

    // Verify counter stayed at 100
    const { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('trial_normalize_writes_used')
      .eq('org_id', testOrgId)
      .single();

    expect(billing?.trial_normalize_writes_used).toBe(100);
  });

  it('enrich_credits limit is 50', async () => {
    // Set counter to 49
    await supabaseAdmin
      .from('org_billing')
      .update({ trial_enrich_credits_used: 49 })
      .eq('org_id', testOrgId);

    // Increment to 50 - should succeed
    const { data: success1 } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'enrich_credits',
      p_increment: 1,
    });

    expect(success1).toBe(true);

    // Try to increment to 51 - should fail
    const { data: success2 } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'enrich_credits',
      p_increment: 1,
    });

    expect(success2).toBe(false);

    // Verify counter stayed at 50
    const { data: billing } = await supabaseAdmin
      .from('org_billing')
      .select('trial_enrich_credits_used')
      .eq('org_id', testOrgId)
      .single();

    expect(billing?.trial_enrich_credits_used).toBe(50);
  });

  it('throws on invalid counter name', async () => {
    // Try to call with invalid counter name
    const { error } = await supabaseAdmin.rpc('increment_trial_counter', {
      p_org_id: testOrgId,
      p_counter_name: 'invalid_counter',
      p_increment: 1,
    });

    // Should throw error
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Invalid counter name');
  });
});
