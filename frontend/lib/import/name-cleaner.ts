/**
 * Name Cleaner - Import Contact Name Normalization
 *
 * Utilities for cleaning names, company names, and email domains
 * before matching against HubSpot records.
 */

// Credential patterns to remove from names
const CREDENTIAL_PATTERNS = [
  // Common credentials
  /\b(MBA|PhD|MS|MSc|M\.S\.|MHA|JD|CPA|CFA|PMP|CDMP|PCM)\b/gi,
  /\b(CHDM|CRME|CSHIP|CPHIMS|IIDA|SEGD|MSLM|LMSW|LCSW)\b/gi,
  /\b(RN|MD|DO|DDS|DVM|PE|RA|FAIA|SHRM|SPHR|PHR)\b/gi,
  /\b(MSLM|CSM|CHDM|AVP|Associate)\b/gi,

  // Symbols
  /[®©™°]/g,

  // Trailing credentials after comma (e.g., "Smith, MBA")
  /,\s*[A-Z][A-Z\.\s]{1,20}$/i,

  // Credentials after dash (e.g., "Smith - CDMP®")
  /\s*[-–]\s*[A-Z][A-Z®\s]{2,}$/,
];

// Legal entity suffixes to remove from company names
const LEGAL_SUFFIXES =
  /\b(LLC|Inc|Corp|Ltd|Co|L\.L\.C\.|Corporation|Incorporated|Limited|Group|Holdings|International|Technologies|Technology|Solutions|Services|Systems)\b\.?/gi;

/**
 * Remove credentials (MBA, PhD, etc.) from last name
 *
 * Examples:
 *   "Sanderson, MBA" → "Sanderson"
 *   "Ullah - CDMP® PCM®" → "Ullah"
 *   "Fermanis, CSHIP" → "Fermanis"
 *   "Virdee-Chapman" → "Virdee-Chapman" (hyphen preserved)
 */
export function cleanLastName(raw: string): string {
  if (!raw) return '';

  let cleaned = raw.trim();

  // Apply all credential patterns
  for (const pattern of CREDENTIAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Clean up extra whitespace and commas
  cleaned = cleaned
    .replace(/,\s*$/, '') // Trailing comma
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\s*-\s*$/, '') // Trailing dash
    .trim();

  return cleaned;
}

/**
 * Split full name into first and last names
 * Handles credentials in full name by cleaning them first
 *
 * Examples:
 *   "Aaron Perreira" → {first: "Aaron", last: "Perreira"}
 *   "Aaron Sanderson, MBA" → {first: "Aaron", last: "Sanderson"}
 *   "John" → {first: "John", last: ""}
 */
export function splitFullName(full: string): { first: string; last: string } {
  if (!full) {
    return { first: '', last: '' };
  }

  // Clean credentials first
  let cleaned = full.trim();
  for (const pattern of CREDENTIAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Clean up whitespace
  cleaned = cleaned
    .replace(/,/g, '') // Remove commas
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .trim();

  // Split on whitespace
  const parts = cleaned.split(/\s+/);

  if (parts.length === 0) {
    return { first: '', last: '' };
  } else if (parts.length === 1) {
    return { first: parts[0], last: '' };
  } else {
    // First word is first name, rest is last name
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    return { first, last };
  }
}

/**
 * Normalize company name for matching
 * Converts to lowercase, removes legal suffixes, strips symbols, collapses whitespace
 *
 * Examples:
 *   "Refine Labs Inc" → "refine labs"
 *   "Apple, Inc." → "apple"
 *   "Acme Corp." → "acme"
 */
export function normalizeCompanyName(raw: string): string {
  if (!raw) return '';

  let normalized = raw.trim();

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Remove legal suffixes
  normalized = normalized.replace(LEGAL_SUFFIXES, '');

  // Remove punctuation and symbols
  normalized = normalized.replace(/[.,;:!?®©™°]/g, '');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extract email domain without TLD
 * Used for company grouping and blocking candidates
 *
 * Examples:
 *   "aaron@refinelabs.com" → "refinelabs"
 *   "hello@example.co.uk" → "example"
 *   "user@sub.domain.com" → "domain"
 */
export function extractEmailDomain(email: string): string {
  if (!email || !email.includes('@')) return '';

  try {
    // Get the part after @
    const parts = email.toLowerCase().split('@');
    if (parts.length !== 2) return '';

    const domain = parts[1];

    // Split by dots
    const domainParts = domain.split('.');

    // If domain has 2+ parts, take the second-to-last (before TLD)
    // e.g., "refinelabs.com" → "refinelabs"
    // e.g., "example.co.uk" → "example" (not "co")
    if (domainParts.length >= 2) {
      // For .co.uk style domains, need to go back 2 parts
      const lastPart = domainParts[domainParts.length - 1];
      const secondLastPart = domainParts[domainParts.length - 2];

      // If TLD is a country code (2 letters) and second-last is also short (2-3 letters),
      // assume it's a .co.uk style domain and take the third-to-last
      if (
        lastPart.length === 2 &&
        secondLastPart.length <= 3 &&
        domainParts.length >= 3
      ) {
        return domainParts[domainParts.length - 3];
      }

      // Otherwise just take second-to-last
      return domainParts[domainParts.length - 2];
    }

    // If only one part (unusual), return it
    return domainParts[0];
  } catch {
    return '';
  }
}
