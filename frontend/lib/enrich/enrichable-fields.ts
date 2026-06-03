/**
 * Enrichable Fields Configuration
 *
 * Defines which fields are enrichable for each object type.
 */

export function getEnrichableFields(objectType: string): string[] {
  if (objectType === 'contact') {
    return [
      'jobtitle',       // Job title (critical for ICP scoring)
      'company',        // Company name text field
      'phone',          // Direct dial
      'mobilephone',    // Mobile number
      'linkedin',       // LinkedIn personal URL
      'city',           // Location targeting
      'state',          // Location targeting
      'country',        // Location targeting
      'email',          // Email (fill only, never overwrite)
    ];
  }

  // Default: company fields
  return [
    'industry',
    'numberofemployees',
    'linkedin_company_page',
    'phone',
    'domain',
    'annualrevenue'
  ];
}
