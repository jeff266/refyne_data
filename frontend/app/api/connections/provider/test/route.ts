import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { decryptKey } from '@/lib/crypto/providerKeys';
import { validateProviderKey } from '@/lib/providers/validate';

/**
 * POST /api/connections/provider/test
 * Test an existing provider connection
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { provider } = body;

  if (!provider) {
    return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
  }

  // Fetch the connection
  const { data: connection, error: fetchError } = await supabase
    .from('provider_connections')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('provider', provider)
    .single();

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Provider connection not found' }, { status: 404 });
  }

  // Decrypt and test the key
  try {
    const apiKey = decryptKey(connection.api_key_enc);
    const validation = await validateProviderKey(provider, apiKey);

    // Update the connection with test results
    const { error: updateError } = await supabase
      .from('provider_connections')
      .update({
        status: validation.valid ? 'active' : 'error',
        last_tested_at: new Date().toISOString(),
        last_error: validation.valid ? null : validation.error || 'Validation failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    if (updateError) {
      console.error('Failed to update test results:', updateError);
    }

    return NextResponse.json({
      success: validation.valid,
      status: validation.valid ? 'active' : 'error',
      error: validation.error,
    });
  } catch (error) {
    console.error('Failed to test provider connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}
