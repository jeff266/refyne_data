import { z } from 'zod';
import {
  ResolvedField,
  createResolvedField,
} from './provenance';

/**
 * Canonical roles - a simplified taxonomy of job functions.
 * Providers return hundreds of variations; we normalize to 6 core roles.
 */
export const RoleSchema = z.enum([
  'executive',      // CEO, President, Founder, C-Suite
  'sales',          // VP Sales, Account Executive, SDR, Sales Manager
  'marketing',      // CMO, VP Marketing, Marketing Manager, Growth
  'operations',     // COO, VP Ops, Operations Manager, RevOps
  'technical',      // CTO, VP Engineering, Developer, IT
  'other',          // Everything else
]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * Canonical seniority levels.
 */
export const SenioritySchema = z.enum([
  'c_suite',        // CEO, CTO, CFO, etc.
  'vp',             // VP, SVP, EVP
  'director',       // Director, Senior Director
  'manager',        // Manager, Senior Manager
  'individual',     // IC, Associate, Specialist
  'entry',          // Intern, Junior, Trainee
]);
export type Seniority = z.infer<typeof SenioritySchema>;

/**
 * Email verification status from providers.
 */
export const EmailStatusSchema = z.enum([
  'verified',       // Confirmed deliverable
  'unverified',     // Not checked
  'invalid',        // Bounced or invalid
  'catch_all',      // Domain accepts all emails
  'disposable',     // Temporary email
]);
export type EmailStatus = z.infer<typeof EmailStatusSchema>;

/**
 * Phone type classification.
 */
export const PhoneTypeSchema = z.enum([
  'direct',         // Direct dial
  'mobile',         // Cell phone
  'work',           // Company main line
  'hq',             // Headquarters
  'other',
]);
export type PhoneType = z.infer<typeof PhoneTypeSchema>;

/**
 * Raw Person fields before wrapping in ResolvedField.
 */
export const PersonFieldsSchema = z.object({
  // Name
  first_name: z.string(),
  last_name: z.string(),
  full_name: z.string(),

  // Contact
  email: z.string().email().nullable(),
  email_status: EmailStatusSchema.nullable(),
  phone: z.string().nullable(),
  phone_type: PhoneTypeSchema.nullable(),
  mobile: z.string().nullable(),

  // Title/Role
  title_raw: z.string().nullable(),       // Original title from provider
  title_normalized: z.string().nullable(), // Cleaned up title
  role: RoleSchema.nullable(),            // Canonical role bucket
  seniority: SenioritySchema.nullable(),

  // Company association
  company_name: z.string().nullable(),
  company_domain: z.string().nullable(),

  // Social/Professional
  linkedin_url: z.string().url().nullable(),

  // Location
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
});

export type PersonFields = z.infer<typeof PersonFieldsSchema>;

/**
 * Canonical Person entity with full provenance.
 */
export interface CanonicalPerson {
  // Name
  first_name: ResolvedField<string>;
  last_name: ResolvedField<string>;
  full_name: ResolvedField<string>;

  // Contact
  email: ResolvedField<string | null>;
  email_status: ResolvedField<EmailStatus | null>;
  phone: ResolvedField<string | null>;
  phone_type: ResolvedField<PhoneType | null>;
  mobile: ResolvedField<string | null>;

  // Title/Role
  title_raw: ResolvedField<string | null>;
  title_normalized: ResolvedField<string | null>;
  role: ResolvedField<Role | null>;
  seniority: ResolvedField<Seniority | null>;

  // Company association
  company_name: ResolvedField<string | null>;
  company_domain: ResolvedField<string | null>;

  // Social/Professional
  linkedin_url: ResolvedField<string | null>;

  // Location
  city: ResolvedField<string | null>;
  state: ResolvedField<string | null>;
  country: ResolvedField<string | null>;

  // Metadata
  _meta: {
    created_at: string;
    updated_at: string;
    providers_used: string[];
  };
}

/**
 * Create an empty CanonicalPerson with null ResolvedFields.
 */
export function createEmptyPerson(
  firstName: string,
  lastName: string,
  provider: string
): CanonicalPerson {
  const now = new Date().toISOString();

  const nullField = <T>(value: T): ResolvedField<T> =>
    createResolvedField(value, provider, now);

  return {
    first_name: createResolvedField(firstName, provider, now),
    last_name: createResolvedField(lastName, provider, now),
    full_name: createResolvedField(`${firstName} ${lastName}`.trim(), provider, now),

    email: nullField(null),
    email_status: nullField(null),
    phone: nullField(null),
    phone_type: nullField(null),
    mobile: nullField(null),

    title_raw: nullField(null),
    title_normalized: nullField(null),
    role: nullField(null),
    seniority: nullField(null),

    company_name: nullField(null),
    company_domain: nullField(null),

    linkedin_url: nullField(null),

    city: nullField(null),
    state: nullField(null),
    country: nullField(null),

    _meta: {
      created_at: now,
      updated_at: now,
      providers_used: [provider],
    },
  };
}

/**
 * Title keywords that map to canonical roles.
 * Used by the default title-to-role Harmony.
 */
export const ROLE_KEYWORDS: Record<Role, string[]> = {
  executive: [
    'ceo', 'chief executive', 'president', 'founder', 'co-founder',
    'owner', 'principal', 'partner', 'coo', 'cfo', 'cto', 'cmo',
    'chief', 'managing director', 'general manager', 'gm',
  ],
  sales: [
    'sales', 'account executive', 'ae', 'sdr', 'bdr', 'business development',
    'account manager', 'revenue', 'commercial', 'enterprise rep',
    'territory', 'quota', 'closer', 'hunter',
  ],
  marketing: [
    'marketing', 'growth', 'demand gen', 'content', 'brand',
    'communications', 'pr', 'public relations', 'social media',
    'digital marketing', 'product marketing', 'pmm', 'campaign',
  ],
  operations: [
    'operations', 'ops', 'revops', 'revenue operations', 'sales ops',
    'marketing ops', 'business ops', 'strategy', 'planning',
    'enablement', 'process', 'systems', 'analytics',
  ],
  technical: [
    'engineering', 'developer', 'software', 'technical', 'architect',
    'devops', 'sre', 'infrastructure', 'platform', 'data engineer',
    'machine learning', 'ai', 'security', 'it', 'tech lead',
  ],
  other: [], // Fallback
};

/**
 * Seniority keywords for detection.
 */
export const SENIORITY_KEYWORDS: Record<Seniority, string[]> = {
  c_suite: ['chief', 'ceo', 'cto', 'cfo', 'cmo', 'coo', 'cro', 'cio'],
  vp: ['vp', 'vice president', 'svp', 'evp', 'avp'],
  director: ['director', 'head of', 'principal'],
  manager: ['manager', 'lead', 'supervisor', 'team lead'],
  individual: ['senior', 'specialist', 'analyst', 'associate', 'consultant'],
  entry: ['junior', 'intern', 'trainee', 'assistant', 'coordinator'],
};

/**
 * Detect role from job title.
 */
export function detectRole(title: string | null): Role | null {
  if (!title) return null;

  const normalized = title.toLowerCase();

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (role === 'other') continue;
    if (keywords.some((kw) => normalized.includes(kw))) {
      return role as Role;
    }
  }

  return 'other';
}

/**
 * Detect seniority from job title.
 */
export function detectSeniority(title: string | null): Seniority | null {
  if (!title) return null;

  const normalized = title.toLowerCase();

  for (const [seniority, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return seniority as Seniority;
    }
  }

  return 'individual'; // Default to IC if no seniority detected
}

/**
 * Flatten a CanonicalPerson to plain values (strips provenance).
 */
export function flattenPerson(person: CanonicalPerson): PersonFields {
  return {
    first_name: person.first_name.value,
    last_name: person.last_name.value,
    full_name: person.full_name.value,
    email: person.email.value,
    email_status: person.email_status.value,
    phone: person.phone.value,
    phone_type: person.phone_type.value,
    mobile: person.mobile.value,
    title_raw: person.title_raw.value,
    title_normalized: person.title_normalized.value,
    role: person.role.value,
    seniority: person.seniority.value,
    company_name: person.company_name.value,
    company_domain: person.company_domain.value,
    linkedin_url: person.linkedin_url.value,
    city: person.city.value,
    state: person.state.value,
    country: person.country.value,
  };
}

/**
 * Get all fields that have values (not null).
 */
export function getPopulatedFields(person: CanonicalPerson): string[] {
  const fields: string[] = [];

  for (const [key, field] of Object.entries(person)) {
    if (key === '_meta') continue;
    if ((field as ResolvedField<unknown>).value !== null) {
      fields.push(key);
    }
  }

  return fields;
}
