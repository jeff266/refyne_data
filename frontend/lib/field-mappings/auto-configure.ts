/**
 * Auto-configure field mappings when HubSpot connects
 *
 * Seeds system mappings for standard HubSpot properties and caches
 * all discovered properties for unmapped property discovery.
 */

import { supabase } from '@/lib/db/supabase';

// Standard HubSpot properties that should be auto-mapped on connect
const STANDARD_COMPANY_PROPERTIES = [
  { canonical: 'name', hubspot: 'name', writePolicy: 'fill_gaps' },
  { canonical: 'domain', hubspot: 'domain', writePolicy: 'fill_gaps' },
  { canonical: 'phone', hubspot: 'phone', writePolicy: 'fill_gaps' },
  { canonical: 'industry', hubspot: 'industry', writePolicy: 'fill_gaps' },
  { canonical: 'city', hubspot: 'city', writePolicy: 'fill_gaps' },
  { canonical: 'state', hubspot: 'state', writePolicy: 'fill_gaps' },
  { canonical: 'country', hubspot: 'country', writePolicy: 'fill_gaps' },
  { canonical: 'zip', hubspot: 'zip', writePolicy: 'fill_gaps' },
  { canonical: 'address', hubspot: 'address', writePolicy: 'fill_gaps' },
  { canonical: 'website', hubspot: 'website', writePolicy: 'fill_gaps' },
  { canonical: 'linkedin_company_page', hubspot: 'linkedin_company_page', writePolicy: 'fill_gaps' },
  { canonical: 'annual_revenue', hubspot: 'annualrevenue', writePolicy: 'fill_gaps' },
  { canonical: 'employee_count', hubspot: 'numberofemployees', writePolicy: 'fill_gaps' },
  { canonical: 'description', hubspot: 'description', writePolicy: 'fill_gaps' },
  { canonical: 'last_modified_at', hubspot: 'hs_lastmodifieddate', writePolicy: 'fill_gaps' },
] as const;

const STANDARD_CONTACT_PROPERTIES = [
  { canonical: 'first_name', hubspot: 'firstname', writePolicy: 'fill_gaps' },
  { canonical: 'last_name', hubspot: 'lastname', writePolicy: 'fill_gaps' },
  { canonical: 'email', hubspot: 'email', writePolicy: 'fill_gaps' },
  { canonical: 'phone', hubspot: 'phone', writePolicy: 'fill_gaps' },
  { canonical: 'job_title', hubspot: 'jobtitle', writePolicy: 'fill_gaps' },
  { canonical: 'city', hubspot: 'city', writePolicy: 'fill_gaps' },
  { canonical: 'state', hubspot: 'state', writePolicy: 'fill_gaps' },
  { canonical: 'country', hubspot: 'country', writePolicy: 'fill_gaps' },
  { canonical: 'linkedin_url', hubspot: 'linkedin_url_contact', writePolicy: 'fill_gaps' },
  { canonical: 'last_modified_at', hubspot: 'hs_lastmodifieddate', writePolicy: 'fill_gaps' },
] as const;

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Seed field mappings and property cache on HubSpot connect
 */
export async function seedFieldMappings(
  orgId: string,
  portalId: string,
  accessToken: string
): Promise<{ systemMappingsCreated: number; propertiesCached: number }> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Fetch all properties from HubSpot
  const [companyProps, contactProps] = await Promise.all([
    fetchHubSpotProperties(accessToken, 'companies'),
    fetchHubSpotProperties(accessToken, 'contacts'),
  ]);

  // Create system mappings for standard properties
  const systemMappingsCreated = await createSystemMappings(
    orgId,
    portalId,
    companyProps,
    contactProps
  );

  // Cache all properties for unmapped discovery
  const propertiesCached = await cacheHubSpotProperties(
    orgId,
    portalId,
    companyProps,
    contactProps
  );

  return { systemMappingsCreated, propertiesCached };
}

/**
 * Fetch all properties for a HubSpot object type
 */
async function fetchHubSpotProperties(
  accessToken: string,
  objectType: 'companies' | 'contacts'
): Promise<HubSpotProperty[]> {
  const response = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${objectType} properties: ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).map((prop: any) => ({
    name: prop.name,
    label: prop.label,
    type: prop.type,
    fieldType: prop.fieldType,
    options: prop.options || undefined,
  }));
}

/**
 * Create system mappings for standard HubSpot properties
 */
async function createSystemMappings(
  orgId: string,
  portalId: string,
  companyProps: HubSpotProperty[],
  contactProps: HubSpotProperty[]
): Promise<number> {
  if (!supabase) return 0;

  const mappingsToCreate = [];

  // Company mappings
  for (const stdProp of STANDARD_COMPANY_PROPERTIES) {
    const hubspotProp = companyProps.find((p) => p.name === stdProp.hubspot);
    if (hubspotProp) {
      mappingsToCreate.push({
        org_id: orgId,
        portal_id: portalId,
        object_type: 'company',
        canonical_field: stdProp.canonical,
        hubspot_property: stdProp.hubspot,
        direction: 'bidirectional',
        write_policy: stdProp.writePolicy,
        field_type: hubspotProp.fieldType,
        valid_values: hubspotProp.options || null,
        canonical_to_hubspot_map: null,
        is_active: true,
        is_system: true,
      });
    }
  }

  // Contact mappings
  for (const stdProp of STANDARD_CONTACT_PROPERTIES) {
    const hubspotProp = contactProps.find((p) => p.name === stdProp.hubspot);
    if (hubspotProp) {
      mappingsToCreate.push({
        org_id: orgId,
        portal_id: portalId,
        object_type: 'contact',
        canonical_field: stdProp.canonical,
        hubspot_property: stdProp.hubspot,
        direction: 'bidirectional',
        write_policy: stdProp.writePolicy,
        field_type: hubspotProp.fieldType,
        valid_values: hubspotProp.options || null,
        canonical_to_hubspot_map: null,
        is_active: true,
        is_system: true,
      });
    }
  }

  if (mappingsToCreate.length === 0) {
    return 0;
  }

  // Upsert system mappings (do nothing if already exists)
  const { error } = await supabase.from('field_mappings').upsert(mappingsToCreate, {
    onConflict: 'org_id,canonical_field,hubspot_property',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[seedFieldMappings] Failed to create system mappings:', error);
    throw new Error('Failed to create system mappings');
  }

  return mappingsToCreate.length;
}

/**
 * Cache all HubSpot properties for unmapped discovery
 */
async function cacheHubSpotProperties(
  orgId: string,
  portalId: string,
  companyProps: HubSpotProperty[],
  contactProps: HubSpotProperty[]
): Promise<number> {
  if (!supabase) return 0;

  const standardCompanyNames: Set<string> = new Set(STANDARD_COMPANY_PROPERTIES.map((p) => p.hubspot as string));
  const standardContactNames: Set<string> = new Set(STANDARD_CONTACT_PROPERTIES.map((p) => p.hubspot as string));

  const propsToCache = [];

  // Cache company properties
  for (const prop of companyProps) {
    const isMapped = standardCompanyNames.has(prop.name);
    const isCustom = !prop.name.startsWith('hs_') && !standardCompanyNames.has(prop.name);

    propsToCache.push({
      org_id: orgId,
      portal_id: portalId,
      object_type: 'company',
      property_name: prop.name,
      property_label: prop.label,
      property_type: prop.type,
      field_type: prop.fieldType,
      is_custom: isCustom,
      is_mapped: isMapped,
      options: prop.options || null,
      cached_at: new Date().toISOString(),
    });
  }

  // Cache contact properties
  for (const prop of contactProps) {
    const isMapped = standardContactNames.has(prop.name);
    const isCustom = !prop.name.startsWith('hs_') && !standardContactNames.has(prop.name);

    propsToCache.push({
      org_id: orgId,
      portal_id: portalId,
      object_type: 'contact',
      property_name: prop.name,
      property_label: prop.label,
      property_type: prop.type,
      field_type: prop.fieldType,
      is_custom: isCustom,
      is_mapped: isMapped,
      options: prop.options || null,
      cached_at: new Date().toISOString(),
    });
  }

  if (propsToCache.length === 0) {
    return 0;
  }

  // Upsert property cache (replace on conflict)
  const { error } = await supabase.from('hubspot_properties_cache').upsert(propsToCache, {
    onConflict: 'org_id,portal_id,object_type,property_name',
  });

  if (error) {
    console.error('[seedFieldMappings] Failed to cache properties:', error);
    throw new Error('Failed to cache HubSpot properties');
  }

  return propsToCache.length;
}

/**
 * Mark a property as mapped in the cache
 */
export async function markPropertyAsMapped(
  orgId: string,
  portalId: string,
  objectType: string,
  propertyName: string
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('hubspot_properties_cache')
    .update({ is_mapped: true })
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType)
    .eq('property_name', propertyName);

  if (error) {
    console.error('[markPropertyAsMapped] Error:', error);
  }
}

/**
 * Get unmapped properties for a portal
 */
export async function getUnmappedProperties(
  orgId: string,
  portalId: string,
  objectType: string
) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('hubspot_properties_cache')
    .select('*')
    .eq('org_id', orgId)
    .eq('portal_id', portalId)
    .eq('object_type', objectType)
    .eq('is_mapped', false)
    .order('property_name');

  if (error) {
    console.error('[getUnmappedProperties] Error:', error);
    return [];
  }

  return data || [];
}
