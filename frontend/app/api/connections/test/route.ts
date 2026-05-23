/**
 * Provider Connection Test API
 *
 * POST /api/connections/test
 *
 * Fires a minimal test API call to verify provider credentials and detect
 * rate limits. Results are stored in provider_connections and audit logged
 * to provider_connection_tests.
 *
 * Security: Uses encrypted credentials, 10s timeout, sanitized errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';

interface TestConnectionRequest {
  connectionId: string;
}

interface RateLimits {
  perMinute?: number;
  daily?: number;
}

/**
 * Extract rate limits from response headers
 */
function extractRateLimits(headers: Headers): RateLimits {
  const rateLimits: RateLimits = {};

  // Common rate limit header patterns
  const perMinuteHeader =
    headers.get('X-RateLimit-Limit') ||
    headers.get('X-Rate-Limit-Limit') ||
    headers.get('RateLimit-Limit');

  const dailyHeader =
    headers.get('X-RateLimit-Limit-Daily') ||
    headers.get('X-Rate-Limit-Daily') ||
    headers.get('RateLimit-Limit-Daily');

  if (perMinuteHeader) {
    rateLimits.perMinute = parseInt(perMinuteHeader, 10);
  }

  if (dailyHeader) {
    rateLimits.daily = parseInt(dailyHeader, 10);
  }

  return rateLimits;
}

/**
 * Test Apollo.io connection
 */
async function testApolloConnection(apiKey: string): Promise<{
  success: boolean;
  headers?: Headers;
  error?: string;
}> {
  try {
    const response = await Promise.race([
      fetch('https://api.apollo.io/v1/users/me', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
      ),
    ]);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      headers: response.headers,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test provider connection based on provider type
 */
async function testProviderConnection(
  provider: string,
  apiKey: string
): Promise<{
  success: boolean;
  headers?: Headers;
  error?: string;
}> {
  switch (provider) {
    case 'apollo':
      return testApolloConnection(apiKey);

    // Add other providers here as they're implemented
    case 'zoominfo':
    case 'cognism':
    case 'graphiq':
      return {
        success: false,
        error: 'Provider test not implemented yet',
      };

    default:
      return {
        success: false,
        error: 'Unknown provider',
      };
  }
}

/**
 * POST /api/connections/test
 *
 * Test a provider connection and detect rate limits
 */
export async function POST(request: NextRequest) {
  // 1. Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId } = ctx;

  try {

    // 2. Parse body
    const body: TestConnectionRequest = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // 3. Get provider connection from database
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { data: connection, error: fetchError } = await supabase
      .from('provider_connections')
      .select('id, org_id, provider, encrypted_api_key')
      .eq('id', connectionId)
      .eq('org_id', orgId) // Verify org ownership
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // 4. Decrypt API key
    const { decryptKey } = await import('@/lib/crypto/providerKeys');
    const apiKey = decryptKey(connection.encrypted_api_key);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Failed to decrypt API key' },
        { status: 500 }
      );
    }

    // 5. Fire test call with timeout
    const testResult = await testProviderConnection(
      connection.provider,
      apiKey
    );

    // 6. Extract rate limits from headers
    const rateLimits = testResult.headers
      ? extractRateLimits(testResult.headers)
      : {};

    // 7. Store rate limits in provider_connections
    if (testResult.success && (rateLimits.perMinute || rateLimits.daily)) {
      const updates: Record<string, any> = {
        last_tested_at: new Date().toISOString(),
      };

      if (rateLimits.perMinute) {
        updates.rate_limit_per_minute = rateLimits.perMinute;
      }
      if (rateLimits.daily) {
        updates.rate_limit_daily = rateLimits.daily;
      }

      await supabase
        .from('provider_connections')
        .update(updates)
        .eq('id', connectionId);
    }

    // 8. Insert audit row into provider_connection_tests
    await supabase.from('provider_connection_tests').insert({
      org_id: orgId,
      provider_connection_id: connectionId,
      success: testResult.success,
      rate_limits: testResult.success ? rateLimits : null,
      tested_at: new Date().toISOString(),
    });

    // 9. Return result
    if (testResult.success) {
      return NextResponse.json({
        success: true,
        rateLimits,
      });
    } else {
      // Never return raw API error - sanitize
      return NextResponse.json(
        {
          success: false,
          error: 'Connection test failed',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Connection test] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
