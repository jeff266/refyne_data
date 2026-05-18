/**
 * HubSpot OAuth Access Token Management
 *
 * Handles token refresh and provides a centralized way to get valid access tokens.
 * Replaces direct usage of private_app_token/encrypted_token throughout the codebase.
 */

import { supabase } from '@/lib/db/supabase';

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Get a valid HubSpot access token for an organization.
 *
 * Automatically refreshes the token if it's expiring within 5 minutes.
 *
 * @param orgId - Organization ID
 * @returns Valid access token
 * @throws Error if connection doesn't exist, is disconnected, or refresh fails
 */
export async function getAccessToken(orgId: string): Promise<string> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Get connection
  const { data: connection, error } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !connection) {
    throw new Error('HubSpot connection not found');
  }

  // Check connection status
  if (connection.connection_status === 'disconnected') {
    throw new Error('HubSpot connection is disconnected');
  }

  if (connection.connection_status === 'error') {
    throw new Error('HubSpot connection has an error - reconnection required');
  }

  // If OAuth connection, check token expiry and refresh if needed
  if (connection.access_token && connection.refresh_token) {
    const expiresAt = new Date(connection.token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    // Refresh if expiring within 5 minutes
    if (expiresAt < fiveMinutesFromNow) {
      console.log(`[getAccessToken] Token expiring soon for org ${orgId}, refreshing...`);
      return await refreshAccessToken(orgId, connection.refresh_token);
    }

    // Update last active timestamp
    await supabase
      .from('hubspot_connections')
      .update({ last_active_at: new Date().toISOString() })
      .eq('org_id', orgId);

    return connection.access_token;
  }

  // Fall back to legacy encrypted_token (PAT) if no OAuth tokens
  if (connection.encrypted_token) {
    // TODO: Decrypt token if encryption is implemented
    // For now, encrypted_token is stored as plain text
    console.warn(`[getAccessToken] Using legacy PAT for org ${orgId} - OAuth migration recommended`);

    await supabase
      .from('hubspot_connections')
      .update({ last_active_at: new Date().toISOString() })
      .eq('org_id', orgId);

    return connection.encrypted_token;
  }

  throw new Error('No valid access token found - please reconnect HubSpot');
}

/**
 * Refresh an expired OAuth access token.
 *
 * @param orgId - Organization ID
 * @param refreshToken - Current refresh token
 * @returns New access token
 * @throws Error if refresh fails
 */
async function refreshAccessToken(orgId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('HubSpot OAuth credentials not configured');
  }

  try {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[refreshAccessToken] Token refresh failed:', errorData);

      // Mark connection as error
      if (supabase) {
        await supabase
          .from('hubspot_connections')
          .update({ connection_status: 'error' })
          .eq('org_id', orgId);
      }

      throw new Error('Token refresh failed - reconnection required');
    }

    const data: TokenRefreshResponse = await response.json();

    // Calculate new expiry
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Update connection with new tokens
    if (supabase) {
      const { error } = await supabase
        .from('hubspot_connections')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          connection_status: 'active',
          last_active_at: new Date().toISOString(),
        })
        .eq('org_id', orgId);

      if (error) {
        console.error('[refreshAccessToken] Failed to update tokens:', error);
        throw new Error('Failed to save refreshed tokens');
      }
    }

    console.log(`[refreshAccessToken] Token refreshed successfully for org ${orgId}`);
    return data.access_token;
  } catch (error) {
    console.error('[refreshAccessToken] Error:', error);

    // Mark connection as error
    if (supabase) {
      await supabase
        .from('hubspot_connections')
        .update({ connection_status: 'error' })
        .eq('org_id', orgId);
    }

    throw error;
  }
}

/**
 * Get connection ID for an organization.
 *
 * Used by routes that need the connection ID rather than just the token.
 *
 * @param orgId - Organization ID
 * @returns Connection ID
 */
export async function getConnectionId(orgId: string): Promise<string> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  const { data: connection, error } = await supabase
    .from('hubspot_connections')
    .select('id')
    .eq('org_id', orgId)
    .single();

  if (error || !connection) {
    throw new Error('HubSpot connection not found');
  }

  return connection.id;
}
