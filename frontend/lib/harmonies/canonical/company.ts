import { z } from 'zod';
import {
  ResolvedField,
  ResolvedFieldSchema,
  createResolvedField,
} from './provenance';

/**
 * Canonical employee count bands.
 * Standardized across all providers.
 */
export const EmployeeBandSchema = z.enum([
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10001+',
]);
export type EmployeeBand = z.infer<typeof EmployeeBandSchema>;

/**
 * Canonical revenue bands.
 * All values normalized to USD.
 */
export const RevenueBandSchema = z.enum([
  '<$1M',
  '$1M-$10M',
  '$10M-$50M',
  '$50M-$100M',
  '$100M-$500M',
  '$500M-$1B',
  '$1B+',
]);
export type RevenueBand = z.infer<typeof RevenueBandSchema>;

/**
 * Canonical industry taxonomy.
 * This is the platform's opinionated default taxonomy.
 * Users can create custom mappings via Harmonies.
 */
export const IndustrySchema = z.enum([
  // Technology
  'software',
  'hardware',
  'semiconductors',
  'telecommunications',
  'it_services',
  'cybersecurity',

  // Finance
  'banking',
  'insurance',
  'investment_management',
  'fintech',

  // Healthcare
  'healthcare_providers',
  'pharmaceuticals',
  'medical_devices',
  'biotechnology',
  'health_tech',

  // Consumer
  'retail',
  'ecommerce',
  'consumer_goods',
  'food_beverage',
  'hospitality',

  // Industrial
  'manufacturing',
  'aerospace_defense',
  'automotive',
  'construction',
  'energy',
  'utilities',

  // Services
  'professional_services',
  'consulting',
  'legal',
  'staffing',
  'marketing_advertising',

  // Other
  'education',
  'nonprofit',
  'government',
  'real_estate',
  'transportation',
  'media_entertainment',
  'agriculture',
  'other',
]);
export type Industry = z.infer<typeof IndustrySchema>;

/**
 * Raw Company fields before wrapping in ResolvedField.
 * These are the scalar values that come from providers.
 */
export const CompanyFieldsSchema = z.object({
  // Core identifiers
  name: z.string(),
  domain: z.string(),

  // Firmographics
  industry: IndustrySchema.nullable(),
  industry_raw: z.string().nullable(), // Original provider value before mapping
  employee_count: z.number().nullable(),
  employee_band: EmployeeBandSchema.nullable(),
  annual_revenue: z.number().nullable(), // In USD
  revenue_band: RevenueBandSchema.nullable(),

  // Location
  hq_country: z.string().nullable(), // ISO 3166 alpha-2
  hq_state: z.string().nullable(),
  hq_city: z.string().nullable(),
  hq_address: z.string().nullable(),
  hq_postal_code: z.string().nullable(),

  // Additional info
  founded_year: z.number().nullable(),
  linkedin_url: z.string().url().nullable(),
  description: z.string().nullable(),
  logo_url: z.string().url().nullable(),
  phone: z.string().nullable(),
  website: z.string().url().nullable(),

  // Technology stack (from BuiltWith, etc.)
  technologies: z.array(z.string()).nullable(),

  // Social
  twitter_url: z.string().url().nullable(),
  facebook_url: z.string().url().nullable(),
});

export type CompanyFields = z.infer<typeof CompanyFieldsSchema>;

/**
 * Canonical Company entity with full provenance.
 * Every field is wrapped in ResolvedField for tracking.
 */
export interface CanonicalCompany {
  // Core identifiers
  name: ResolvedField<string>;
  domain: ResolvedField<string>;

  // Firmographics
  industry: ResolvedField<Industry | null>;
  industry_raw: ResolvedField<string | null>;
  employee_count: ResolvedField<number | null>;
  employee_band: ResolvedField<EmployeeBand | null>;
  annual_revenue: ResolvedField<number | null>;
  revenue_band: ResolvedField<RevenueBand | null>;

  // Location
  hq_country: ResolvedField<string | null>;
  hq_state: ResolvedField<string | null>;
  hq_city: ResolvedField<string | null>;
  hq_address: ResolvedField<string | null>;
  hq_postal_code: ResolvedField<string | null>;

  // Additional info
  founded_year: ResolvedField<number | null>;
  linkedin_url: ResolvedField<string | null>;
  description: ResolvedField<string | null>;
  logo_url: ResolvedField<string | null>;
  phone: ResolvedField<string | null>;
  website: ResolvedField<string | null>;

  // Technology stack
  technologies: ResolvedField<string[] | null>;

  // Social
  twitter_url: ResolvedField<string | null>;
  facebook_url: ResolvedField<string | null>;

  // Metadata
  _meta: {
    created_at: string;
    updated_at: string;
    providers_used: string[];
  };
}

/**
 * Create an empty CanonicalCompany with null ResolvedFields.
 * Used as a starting point before enrichment.
 */
export function createEmptyCompany(
  name: string,
  domain: string,
  provider: string
): CanonicalCompany {
  const now = new Date().toISOString();

  const nullField = <T>(value: T): ResolvedField<T> =>
    createResolvedField(value, provider, now);

  return {
    name: createResolvedField(name, provider, now),
    domain: createResolvedField(domain, provider, now),

    industry: nullField(null),
    industry_raw: nullField(null),
    employee_count: nullField(null),
    employee_band: nullField(null),
    annual_revenue: nullField(null),
    revenue_band: nullField(null),

    hq_country: nullField(null),
    hq_state: nullField(null),
    hq_city: nullField(null),
    hq_address: nullField(null),
    hq_postal_code: nullField(null),

    founded_year: nullField(null),
    linkedin_url: nullField(null),
    description: nullField(null),
    logo_url: nullField(null),
    phone: nullField(null),
    website: nullField(null),

    technologies: nullField(null),

    twitter_url: nullField(null),
    facebook_url: nullField(null),

    _meta: {
      created_at: now,
      updated_at: now,
      providers_used: [provider],
    },
  };
}

/**
 * Convert employee count to canonical band.
 */
export function employeeCountToBand(count: number | null): EmployeeBand | null {
  if (count === null) return null;

  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '501-1000';
  if (count <= 5000) return '1001-5000';
  if (count <= 10000) return '5001-10000';
  return '10001+';
}

/**
 * Convert annual revenue to canonical band.
 * Assumes revenue is in USD.
 */
export function revenueToBand(revenue: number | null): RevenueBand | null {
  if (revenue === null) return null;

  if (revenue < 1_000_000) return '<$1M';
  if (revenue < 10_000_000) return '$1M-$10M';
  if (revenue < 50_000_000) return '$10M-$50M';
  if (revenue < 100_000_000) return '$50M-$100M';
  if (revenue < 500_000_000) return '$100M-$500M';
  if (revenue < 1_000_000_000) return '$500M-$1B';
  return '$1B+';
}

/**
 * Flatten a CanonicalCompany to plain values (strips provenance).
 * Useful for display or export.
 */
export function flattenCompany(company: CanonicalCompany): CompanyFields {
  return {
    name: company.name.value,
    domain: company.domain.value,
    industry: company.industry.value,
    industry_raw: company.industry_raw.value,
    employee_count: company.employee_count.value,
    employee_band: company.employee_band.value,
    annual_revenue: company.annual_revenue.value,
    revenue_band: company.revenue_band.value,
    hq_country: company.hq_country.value,
    hq_state: company.hq_state.value,
    hq_city: company.hq_city.value,
    hq_address: company.hq_address.value,
    hq_postal_code: company.hq_postal_code.value,
    founded_year: company.founded_year.value,
    linkedin_url: company.linkedin_url.value,
    description: company.description.value,
    logo_url: company.logo_url.value,
    phone: company.phone.value,
    website: company.website.value,
    technologies: company.technologies.value,
    twitter_url: company.twitter_url.value,
    facebook_url: company.facebook_url.value,
  };
}

/**
 * Get all fields that have values (not null).
 * Useful for debugging/inspection.
 */
export function getPopulatedFields(company: CanonicalCompany): string[] {
  const fields: string[] = [];

  for (const [key, field] of Object.entries(company)) {
    if (key === '_meta') continue;
    if ((field as ResolvedField<unknown>).value !== null) {
      fields.push(key);
    }
  }

  return fields;
}
