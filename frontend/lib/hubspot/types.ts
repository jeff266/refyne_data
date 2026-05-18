/**
 * HubSpot Integration Types
 *
 * Type definitions for the HubSpot CRM integration.
 */

/**
 * HubSpot connection stored in database.
 */
export interface HubSpotConnection {
  id: string;
  orgId: string;
  portalId: string;
  encryptedToken: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  /** Whether connection has crm.export scope (enables Export API for faster indexing) */
  hasExportScope: boolean;
}

/**
 * HubSpot connection row from database (snake_case).
 */
export interface HubSpotConnectionRow {
  id: string;
  org_id: string;
  portal_id: string;
  encrypted_token: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
  has_export_scope: boolean;
}

/**
 * HubSpot company list metadata.
 */
export interface HubSpotList {
  listId: string;
  name: string;
  objectTypeId: string; // '0-2' for companies
  memberCount: number;
}

/**
 * HubSpot company record from API.
 */
export interface HubSpotCompany {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
}

/**
 * HubSpot property definition.
 */
export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{
    label: string;
    value: string;
    displayOrder: number;
  }>;
}

/**
 * Token validation result from HubSpot OAuth endpoint.
 */
export interface TokenValidationResult {
  valid: boolean;
  portalId?: string;
  scopes?: string[];
  missingScopes?: string[];
  error?: string;
  /** Whether the token has crm.export scope (enables Export API for faster indexing) */
  hasExportScope?: boolean;
}

/**
 * Required scopes for v1 HubSpot integration.
 */
export const REQUIRED_SCOPES = [
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.schemas.companies.read',
  'crm.lists.read',
] as const;

/**
 * Default HubSpot properties to fetch for companies.
 */
export const DEFAULT_COMPANY_PROPERTIES = [
  'name',
  'domain',
  'industry',
  'annualrevenue',
  'numberofemployees',
  'phone',
  'city',
  'state',
  'country',
  'zip',
  'address',
  'linkedin_company_page',
  'description',
  'website',
  'founded_year',
] as const;

/**
 * Field mapping direction.
 */
export type FieldMappingDirection = 'read' | 'write' | 'bidirectional';

/**
 * Write policy for field mappings.
 */
export type WritePolicy = 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';

/**
 * Enum value option from HubSpot schema.
 */
export interface EnumValueOption {
  value: string;
  label: string;
}

/**
 * Canonical to HubSpot enum value mapping.
 * Used to translate canonical values to workspace-specific HubSpot enum values.
 */
export type CanonicalToHubSpotMap = Record<string, string>;

/**
 * Field mapping configuration.
 */
export interface FieldMapping {
  id: string;
  canonicalField: string;
  hubspotProperty: string;
  direction: FieldMappingDirection;
  writePolicy: WritePolicy;
  validValues: EnumValueOption[] | null;
  fieldType: string | null;
  canonicalToHubspotMap: CanonicalToHubSpotMap | null;
  isActive: boolean;
}

/**
 * Field mapping row from database (snake_case).
 */
export interface FieldMappingRow {
  id: string;
  org_id: string;
  canonical_field: string;
  hubspot_property: string;
  direction: FieldMappingDirection;
  write_policy: WritePolicy;
  valid_values: EnumValueOption[] | null;
  field_type: string | null;
  canonical_to_hubspot_map: CanonicalToHubSpotMap | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Default field mappings (canonical → HubSpot).
 */
export const DEFAULT_FIELD_MAPPINGS: Array<{
  canonicalField: string;
  hubspotProperty: string;
}> = [
  { canonicalField: 'company.name', hubspotProperty: 'name' },
  { canonicalField: 'company.domain', hubspotProperty: 'domain' },
  { canonicalField: 'company.industry', hubspotProperty: 'industry' },
  { canonicalField: 'company.revenue', hubspotProperty: 'annualrevenue' },
  { canonicalField: 'company.employees', hubspotProperty: 'numberofemployees' },
  { canonicalField: 'company.phone', hubspotProperty: 'phone' },
  { canonicalField: 'company.address.country', hubspotProperty: 'country' },
  { canonicalField: 'company.address.state', hubspotProperty: 'state' },
  { canonicalField: 'company.address.city', hubspotProperty: 'city' },
  { canonicalField: 'company.address.street', hubspotProperty: 'address' },
  { canonicalField: 'company.address.postal_code', hubspotProperty: 'zip' },
  { canonicalField: 'company.linkedin_url', hubspotProperty: 'linkedin_company_page' },
  { canonicalField: 'company.description', hubspotProperty: 'description' },
  { canonicalField: 'company.website', hubspotProperty: 'website' },
  { canonicalField: 'company.founded_year', hubspotProperty: 'founded_year' },
];

/**
 * HubSpot API error response.
 */
export interface HubSpotApiError {
  status: string;
  message: string;
  correlationId: string;
  category: string;
}

/**
 * Paginated response from HubSpot API.
 */
export interface HubSpotPaginatedResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}
