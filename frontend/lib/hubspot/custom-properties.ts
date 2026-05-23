/**
 * HubSpot Custom Property Management
 *
 * Creates and manages Refyne-managed custom properties for fallback data.
 * Used when field mappings are not configured or when normalization doesn't
 * match HubSpot enum values.
 *
 * Requires: crm.schemas.companies.write scope
 * Graceful degradation: Logs warning if scope missing, does not block enrichment
 */

interface PropertyDefinition {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description: string;
}

const REFYNE_PROPERTIES: PropertyDefinition[] = [
  {
    name: 'refyne_industry',
    label: 'Refyne Industry',
    type: 'string',
    fieldType: 'text',
    groupName: 'refynedata',
    description:
      'Industry value from Refyne enrichment. Configure field mappings to write to your standard industry field instead.',
  },
  {
    name: 'refyne_industry_naics',
    label: 'Refyne Industry NAICS',
    type: 'string',
    fieldType: 'text',
    groupName: 'refynedata',
    description: '6-digit NAICS code from Refyne enrichment.',
  },
  {
    name: 'refyne_employee_count',
    label: 'Refyne Employee Count',
    type: 'number',
    fieldType: 'number',
    groupName: 'refynedata',
    description: 'Employee count from Refyne enrichment.',
  },
  {
    name: 'refyne_revenue',
    label: 'Refyne Revenue',
    type: 'number',
    fieldType: 'number',
    groupName: 'refynedata',
    description: 'Annual revenue from Refyne enrichment.',
  },
  {
    name: 'refyne_phone',
    label: 'Refyne Phone',
    type: 'string',
    fieldType: 'text',
    groupName: 'refynedata',
    description: 'Phone number from Refyne enrichment.',
  },
  {
    name: 'refyne_linkedin_url',
    label: 'Refyne LinkedIn URL',
    type: 'string',
    fieldType: 'text',
    groupName: 'refynedata',
    description: 'LinkedIn URL from Refyne enrichment.',
  },
];

/**
 * Check if HubSpot access token has schema write permission
 */
export async function hasSchemaWritePermission(
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(
        `[HubSpot] Failed to check token scopes: ${response.status}`
      );
      return false;
    }

    const data = await response.json();
    const scopes = data.scopes || [];

    return scopes.includes('crm.schemas.companies.write');
  } catch (error) {
    console.error('[HubSpot] Error checking schema write permission:', error);
    return false;
  }
}

/**
 * Check if a property already exists
 */
async function propertyExists(
  accessToken: string,
  propertyName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/properties/companies/${propertyName}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error(
      `[HubSpot] Error checking property ${propertyName}:`,
      error
    );
    return false;
  }
}

/**
 * Ensure Refyne property group exists
 */
async function ensureRefynePropertyGroup(
  accessToken: string
): Promise<void> {
  try {
    // Check if group exists
    const checkResponse = await fetch(
      'https://api.hubapi.com/crm/v3/properties/companies/groups/refynedata',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (checkResponse.ok) {
      // Group already exists
      return;
    }

    // Create group
    const createResponse = await fetch(
      'https://api.hubapi.com/crm/v3/properties/companies/groups',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'refynedata',
          label: 'Refyne Data',
          displayOrder: -1,
        }),
      }
    );

    if (!createResponse.ok) {
      console.warn(
        `[HubSpot] Failed to create property group: ${createResponse.status}`
      );
    } else {
      console.log('[HubSpot] Created property group: refynedata');
    }
  } catch (error) {
    console.error('[HubSpot] Error ensuring property group:', error);
  }
}

/**
 * Create Refyne custom properties in HubSpot
 *
 * Called automatically when HubSpot connection is established.
 * Gracefully degrades if crm.schemas.companies.write scope is missing.
 *
 * Security: Never blocks enrichment if property creation fails.
 */
export async function ensureRefyneProperties(
  accessToken: string
): Promise<void> {
  // Check scope first
  const hasScope = await hasSchemaWritePermission(accessToken);
  if (!hasScope) {
    console.warn(
      '[HubSpot] Missing crm.schemas.companies.write scope. ' +
        'Refyne custom properties will not be created. ' +
        'Add this scope in HubSpot portal > Settings > Integrations > Private Apps.'
    );
    return;
  }

  // Create property group first
  await ensureRefynePropertyGroup(accessToken);

  // Create each property idempotently
  for (const prop of REFYNE_PROPERTIES) {
    try {
      const exists = await propertyExists(accessToken, prop.name);
      if (exists) {
        console.log(`[HubSpot] Property ${prop.name} already exists`);
        continue;
      }

      // Create property
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/properties/companies',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(prop),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[HubSpot] Failed to create ${prop.name}: ${response.status} ${errorText}`
        );
      } else {
        console.log(`[HubSpot] Created property: ${prop.name}`);
      }
    } catch (error) {
      // Never block enrichment due to property creation failure
      console.error(`[HubSpot] Failed to create ${prop.name}:`, error);
    }
  }

  console.log('[HubSpot] Refyne custom properties setup complete');
}

/**
 * Get list of all Refyne property names
 */
export function getRefynePropertyNames(): string[] {
  return REFYNE_PROPERTIES.map((p) => p.name);
}

/**
 * Check if a property name is a Refyne-managed property
 */
export function isRefyneProperty(propertyName: string): boolean {
  return propertyName.startsWith('refyne_');
}

/**
 * Get canonical field key from Refyne property name
 *
 * Example: refyne_industry -> industry
 */
export function getCanonicalFieldFromRefyneProperty(
  refynePropertyName: string
): string | null {
  if (!isRefyneProperty(refynePropertyName)) return null;

  return refynePropertyName.replace(/^refyne_/, '');
}

/**
 * Get Refyne property name from canonical field key
 *
 * Example: industry -> refyne_industry
 */
export function getRefynePropertyName(canonicalField: string): string {
  return `refyne_${canonicalField}`;
}
