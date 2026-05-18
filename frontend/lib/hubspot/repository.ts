/**
 * HubSpot Repository
 *
 * Data access layer for HubSpot connections and field mappings.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import type {
  HubSpotConnection,
  HubSpotConnectionRow,
  FieldMapping,
  FieldMappingRow,
  EnumValueOption,
} from './types';
import { DEFAULT_FIELD_MAPPINGS } from './types';
import type { SchemaProperty } from './client';

// ─────────────────────────────────────────────────────────────
// HubSpot Connections
// ─────────────────────────────────────────────────────────────

/**
 * Get HubSpot connection for an org.
 */
export async function getConnection(orgId: string): Promise<HubSpotConnection | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToConnection(data as HubSpotConnectionRow);
}

/**
 * Get HubSpot connection by portal ID.
 * Used by webhook handler to look up org.
 */
export async function getConnectionByPortalId(
  portalId: string
): Promise<HubSpotConnection | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('portal_id', portalId)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToConnection(data as HubSpotConnectionRow);
}

/**
 * Save or update HubSpot connection for an org.
 */
export async function saveConnection(
  orgId: string,
  portalId: string,
  encryptedToken: string,
  scopes: string[],
  hasExportScope = false
): Promise<HubSpotConnection | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured - connection not saved');
    return null;
  }

  const { data, error } = await supabase
    .from('hubspot_connections')
    .upsert({
      org_id: orgId,
      portal_id: portalId,
      encrypted_token: encryptedToken,
      scopes,
      has_export_scope: hasExportScope,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to save HubSpot connection:', error);
    return null;
  }

  // Seed default field mappings for this org
  await seedDefaultFieldMappings(orgId);

  return rowToConnection(data as HubSpotConnectionRow);
}

/**
 * Delete HubSpot connection for an org.
 *
 * For OAuth connections, revokes the access token at HubSpot before disconnecting.
 * Sets connection_status to 'disconnected' and zeros out tokens (does not delete the row).
 */
export async function deleteConnection(orgId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  // Get connection first to check for OAuth tokens
  const { data: connection } = await supabase
    .from('hubspot_connections')
    .select('*')
    .eq('org_id', orgId)
    .single();

  // Revoke OAuth token at HubSpot if it's an OAuth connection
  if (connection?.access_token) {
    try {
      const response = await fetch(
        `https://api.hubapi.com/oauth/v1/refresh-tokens/${connection.refresh_token}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        console.warn('[deleteConnection] Failed to revoke token at HubSpot (non-fatal):', await response.text());
      } else {
        console.log('[deleteConnection] OAuth token revoked successfully');
      }
    } catch (error) {
      console.warn('[deleteConnection] Error revoking token at HubSpot (non-fatal):', error);
    }
  }

  // Update connection: set status to disconnected and zero out tokens
  const { error } = await supabase
    .from('hubspot_connections')
    .update({
      connection_status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      disconnected_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  if (error) {
    console.error('Failed to disconnect HubSpot connection:', error);
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// Field Mappings
// ─────────────────────────────────────────────────────────────

/**
 * Get field mappings for an org.
 * Returns defaults if none exist.
 */
export async function getFieldMappings(orgId: string): Promise<FieldMapping[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return getDefaultFieldMappings();
  }

  const { data, error } = await supabase
    .from('field_mappings')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (error || !data || data.length === 0) {
    return getDefaultFieldMappings();
  }

  return (data as FieldMappingRow[]).map(rowToFieldMapping);
}

/**
 * Seed default field mappings for an org.
 */
export async function seedDefaultFieldMappings(orgId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  const mappings = DEFAULT_FIELD_MAPPINGS.map(m => ({
    org_id: orgId,
    canonical_field: m.canonicalField,
    hubspot_property: m.hubspotProperty,
  }));

  // Use upsert with on conflict do nothing
  const { error } = await supabase
    .from('field_mappings')
    .upsert(mappings, {
      onConflict: 'org_id,canonical_field',
      ignoreDuplicates: true,
    });

  if (error) {
    console.error('Failed to seed field mappings:', error);
  }
}

/**
 * Update a field mapping.
 */
export async function updateFieldMapping(
  mappingId: string,
  updates: Partial<Pick<FieldMapping, 'hubspotProperty' | 'direction' | 'writePolicy' | 'validValues' | 'fieldType' | 'canonicalToHubspotMap' | 'isActive'>>
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.hubspotProperty !== undefined) {
    updateData.hubspot_property = updates.hubspotProperty;
  }
  if (updates.direction !== undefined) {
    updateData.direction = updates.direction;
  }
  if (updates.writePolicy !== undefined) {
    updateData.write_policy = updates.writePolicy;
  }
  if (updates.validValues !== undefined) {
    updateData.valid_values = updates.validValues;
  }
  if (updates.fieldType !== undefined) {
    updateData.field_type = updates.fieldType;
  }
  if (updates.canonicalToHubspotMap !== undefined) {
    updateData.canonical_to_hubspot_map = updates.canonicalToHubspotMap;
  }
  if (updates.isActive !== undefined) {
    updateData.is_active = updates.isActive;
  }

  const { error } = await supabase
    .from('field_mappings')
    .update(updateData)
    .eq('id', mappingId);

  if (error) {
    console.error('Failed to update field mapping:', error);
    return false;
  }

  return true;
}

/**
 * Upsert schema-discovered field mappings.
 * Called after schema sync to store HubSpot enum options.
 */
export async function upsertSchemaFieldMappings(
  orgId: string,
  schemaProperties: SchemaProperty[]
): Promise<{ upserted: number; errors: number }> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured - schema mappings not saved');
    return { upserted: 0, errors: 0 };
  }

  let upserted = 0;
  let errors = 0;

  // Process each enum property
  for (const prop of schemaProperties) {
    // Only process company properties for now (contacts TBD)
    if (prop.objectType !== 'companies') continue;

    // Find matching canonical field from defaults
    const defaultMapping = DEFAULT_FIELD_MAPPINGS.find(
      m => m.hubspotProperty === prop.property
    );

    // Only upsert if we have a canonical field mapping
    if (!defaultMapping) continue;

    const validValues: EnumValueOption[] = prop.options.map(opt => ({
      value: opt.value,
      label: opt.label,
    }));

    const { error } = await supabase
      .from('field_mappings')
      .upsert({
        org_id: orgId,
        canonical_field: defaultMapping.canonicalField,
        hubspot_property: prop.property,
        valid_values: validValues,
        field_type: prop.fieldType,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,canonical_field',
      });

    if (error) {
      console.error(`Failed to upsert schema mapping for ${prop.property}:`, error);
      errors++;
    } else {
      upserted++;
    }
  }

  return { upserted, errors };
}

/**
 * Get field mapping by canonical field name.
 */
export async function getFieldMappingByCanonicalField(
  orgId: string,
  canonicalField: string
): Promise<FieldMapping | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('field_mappings')
    .select('*')
    .eq('org_id', orgId)
    .eq('canonical_field', canonicalField)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToFieldMapping(data as FieldMappingRow);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function rowToConnection(row: HubSpotConnectionRow): HubSpotConnection {
  return {
    id: row.id,
    orgId: row.org_id,
    portalId: row.portal_id,
    encryptedToken: row.encrypted_token,
    scopes: row.scopes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasExportScope: row.has_export_scope ?? false,
  };
}

function rowToFieldMapping(row: FieldMappingRow): FieldMapping {
  return {
    id: row.id,
    canonicalField: row.canonical_field,
    hubspotProperty: row.hubspot_property,
    direction: row.direction,
    writePolicy: row.write_policy,
    validValues: row.valid_values,
    fieldType: row.field_type,
    canonicalToHubspotMap: row.canonical_to_hubspot_map,
    isActive: row.is_active,
  };
}

function getDefaultFieldMappings(): FieldMapping[] {
  return DEFAULT_FIELD_MAPPINGS.map((m, i) => ({
    id: `default-${i}`,
    canonicalField: m.canonicalField,
    hubspotProperty: m.hubspotProperty,
    direction: 'bidirectional' as const,
    writePolicy: 'overwrite_if_blank_or_ours' as const,
    validValues: null,
    fieldType: null,
    canonicalToHubspotMap: null,
    isActive: true,
  }));
}
