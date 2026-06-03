/**
 * Enrichable Fields Configuration
 *
 * Defines which fields are enrichable for each object type.
 */

export function getEnrichableFields(objectType: string): string[] {
  if (objectType === 'contact') {
    return [
      'firstname',
      'lastname',
      'email',
      'phone',
      'jobtitle',
      'company',
      'city',
      'state',
      'country'
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
