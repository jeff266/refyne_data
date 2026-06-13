/**
 * Clear cached workspace context to force rebuild with correct model
 *
 * Usage: npx tsx scripts/clear-workspace-context.ts <org_id>
 */

import { supabaseAdmin } from '../lib/db/admin-client';

const orgId = process.argv[2];

if (!orgId) {
  console.error('Usage: npx tsx scripts/clear-workspace-context.ts <org_id>');
  console.error('Example: npx tsx scripts/clear-workspace-context.ts org_3DuSdb0FBnx7RMLmJSUegrpiNLS');
  process.exit(1);
}

async function clearWorkspaceContext() {
  console.log(`[Clear Context] Checking workspace_context for org: ${orgId}`);

  // Check existing context
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('workspace_context')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[Clear Context] Error fetching context:', fetchError);
    process.exit(1);
  }

  if (!existing) {
    console.log('[Clear Context] No cached context found. Nothing to clear.');
    process.exit(0);
  }

  console.log('[Clear Context] Current context:');
  console.log(`  - Version: ${existing.version}`);
  console.log(`  - Built at: ${existing.built_at}`);
  console.log(`  - Built by: ${existing.built_by}`);
  console.log(`  - Hash: ${existing.context_hash}`);

  // Delete the cached context
  const { error: deleteError } = await supabaseAdmin
    .from('workspace_context')
    .delete()
    .eq('org_id', orgId);

  if (deleteError) {
    console.error('[Clear Context] Error deleting context:', deleteError);
    process.exit(1);
  }

  console.log('[Clear Context] ✅ Cached context cleared successfully');
  console.log('[Clear Context] Next assistant chat will rebuild context with correct model');
}

clearWorkspaceContext();
