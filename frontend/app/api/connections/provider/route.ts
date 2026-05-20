import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { encryptKey, keyHint } from '@/lib/crypto/providerKeys';
import { validateProviderKey } from '@/lib/providers/validate';

const ALLOWED_PROVIDERS = ['apollo', 'zoominfo', 'cognism', 'clearbit', 'proxycurl'];

/**
 * POST /api/connections/provider
 * Connect a new BYOK provider
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { provider, apiKey } = body;

  // Validate provider
  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { success: false, error: 'Invalid provider' },
      { status: 400 }
    );
  }

  // Validate API key format
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key format' },
      { status: 400 }
    );
  }

  // Test the key against the provider's API
  const validation = await validateProviderKey(provider, apiKey);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error || 'Invalid API key — check your provider dashboard',
      },
      { status: 400 }
    );
  }

  // Encrypt the key and compute hint
  const encrypted = encryptKey(apiKey);
  const hint = keyHint(apiKey);

  // Upsert into provider_connections
  const { error } = await supabase.from('provider_connections').upsert(
    {
      org_id: ctx.orgId,
      provider,
      api_key_enc: encrypted,
      key_hint: hint,
      status: 'active',
      last_error: null,
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'org_id,provider',
    }
  );

  if (error) {
    console.error('Failed to save provider connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save connection' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    hint,
    status: 'active',
  });
}

/**
 * DELETE /api/connections/provider
 * Disconnect a provider (soft delete)
 */
export async function DELETE(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { provider } = body;

  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  // Soft delete by setting status to revoked
  const { error } = await supabase
    .from('provider_connections')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', ctx.orgId)
    .eq('provider', provider);

  if (error) {
    console.error('Failed to disconnect provider:', error);
    return NextResponse.json({ error: 'Failed to disconnect provider' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
