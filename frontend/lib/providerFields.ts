/**
 * Provider Output Fields Configuration
 *
 * Defines what fields each enrichment provider can return.
 * Used for field selection dropdowns in cascade configuration.
 */

export interface ProviderField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'array' | 'boolean';
  description?: string;
}

export interface ProviderCost {
  id: string;
  name: string;
  costPerRecord: number; // in dollars
  avgResponseMs: number;
}

/**
 * Provider costs for cascade optimization (sorted by cost, cheapest first)
 */
export const PROVIDER_COSTS: ProviderCost[] = [
  { id: 'graphiq', name: 'GraphIQ', costPerRecord: 0.002, avgResponseMs: 800 },
  { id: 'yelp', name: 'Yelp', costPerRecord: 0.003, avgResponseMs: 600 },
  { id: 'serper', name: 'Serper', costPerRecord: 0.004, avgResponseMs: 500 },
  { id: 'apollo', name: 'Apollo', costPerRecord: 0.01, avgResponseMs: 1200 },
  { id: 'clay', name: 'Clay', costPerRecord: 0.015, avgResponseMs: 2000 },
  { id: 'zoominfo', name: 'ZoomInfo', costPerRecord: 0.05, avgResponseMs: 1500 },
];

export interface ProviderFieldGroup {
  provider: string;
  providerLabel: string;
  fields: ProviderField[];
}

/**
 * Fields that each provider can output after enrichment
 */
export const PROVIDER_OUTPUT_FIELDS: Record<string, ProviderField[]> = {
  yelp: [
    { key: 'name', label: 'Company Name', type: 'string', description: 'Business name from Yelp' },
    { key: 'address', label: 'Address', type: 'string', description: 'Full street address' },
    { key: 'phone', label: 'Phone Number', type: 'string', description: 'Business phone number' },
    { key: 'website', label: 'Website URL', type: 'string', description: 'Business website' },
    { key: 'yelp_rating', label: 'Yelp Rating', type: 'number', description: 'Yelp rating (1-5 stars)' },
    { key: 'yelp_review_count', label: 'Yelp Reviews', type: 'number', description: 'Number of Yelp reviews' },
    { key: 'yelp_url', label: 'Yelp Page', type: 'string', description: 'Link to Yelp business page' },
    { key: 'price_level', label: 'Price Level', type: 'string', description: 'Price range ($, $$, $$$, $$$$)' },
    { key: 'categories', label: 'Categories', type: 'array', description: 'Yelp business categories' },
    { key: 'hours', label: 'Business Hours', type: 'string', description: 'Operating hours' },
    { key: 'is_closed', label: 'Permanently Closed', type: 'boolean', description: 'Whether business is closed' },
    { key: 'photos', label: 'Photos', type: 'array', description: 'Business photo URLs' },
  ],
  serper: [
    { key: 'name', label: 'Company Name', type: 'string', description: 'Business name from Google Maps' },
    { key: 'address', label: 'Address', type: 'string', description: 'Full street address' },
    { key: 'phone', label: 'Phone Number', type: 'string', description: 'Business phone number' },
    { key: 'website', label: 'Website URL', type: 'string', description: 'Company website' },
    { key: 'rating', label: 'Rating', type: 'number', description: 'Google Maps rating (1-5)' },
    { key: 'reviews_count', label: 'Reviews Count', type: 'number', description: 'Number of Google reviews' },
    { key: 'place_id', label: 'Place ID', type: 'string', description: 'Google Maps Place ID' },
    { key: 'category', label: 'Category', type: 'string', description: 'Business category' },
    { key: 'hours', label: 'Business Hours', type: 'string', description: 'Operating hours' },
  ],
  apollo: [
    { key: 'name', label: 'Company Name', type: 'string', description: 'Organization name' },
    { key: 'domain', label: 'Domain', type: 'string', description: 'Company domain' },
    { key: 'employee_count', label: 'Employee Count', type: 'number', description: 'Number of employees' },
    { key: 'revenue', label: 'Revenue', type: 'string', description: 'Annual revenue estimate' },
    { key: 'industry', label: 'Industry', type: 'string', description: 'Primary industry' },
    { key: 'email', label: 'Email', type: 'string', description: 'Contact email address' },
    { key: 'phone', label: 'Phone', type: 'string', description: 'Contact phone number' },
    { key: 'linkedin_url', label: 'LinkedIn URL', type: 'string', description: 'Company LinkedIn page' },
    { key: 'city', label: 'City', type: 'string', description: 'Headquarters city' },
    { key: 'state', label: 'State', type: 'string', description: 'Headquarters state' },
    { key: 'country', label: 'Country', type: 'string', description: 'Headquarters country' },
    { key: 'founded_year', label: 'Founded Year', type: 'number', description: 'Year company was founded' },
    { key: 'company_type', label: 'Company Type', type: 'string', description: 'Private, Public, etc.' },
  ],
  zoominfo: [
    { key: 'name', label: 'Company Name', type: 'string', description: 'Organization name' },
    { key: 'domain', label: 'Domain', type: 'string', description: 'Company domain' },
    { key: 'employee_count', label: 'Employee Count', type: 'number', description: 'Number of employees' },
    { key: 'revenue', label: 'Revenue', type: 'string', description: 'Annual revenue estimate' },
    { key: 'email', label: 'Verified Email', type: 'string', description: 'Verified contact email' },
    { key: 'direct_dial', label: 'Direct Dial', type: 'string', description: 'Direct phone number' },
    { key: 'verified_contacts', label: 'Verified Contacts', type: 'array', description: 'List of verified contacts' },
    { key: 'technologies', label: 'Technologies', type: 'array', description: 'Tech stack information' },
    { key: 'intent_signals', label: 'Intent Signals', type: 'array', description: 'Buying intent data' },
    { key: 'sic_code', label: 'SIC Code', type: 'string', description: 'Standard Industry Classification' },
    { key: 'naics_code', label: 'NAICS Code', type: 'string', description: 'North American Industry Classification' },
  ],
  graphiq: [
    { key: 'name', label: 'Company Name', type: 'string', description: 'Organization name' },
    { key: 'domain', label: 'Domain', type: 'string', description: 'Company domain' },
    { key: 'capabilities', label: 'Capabilities', type: 'array', description: 'Company capabilities' },
    { key: 'employee_count', label: 'Employee Count', type: 'number', description: 'Number of employees' },
    { key: 'funding', label: 'Funding', type: 'string', description: 'Total funding raised' },
    { key: 'technologies', label: 'Technologies', type: 'array', description: 'Tech stack information' },
    { key: 'competitors', label: 'Competitors', type: 'array', description: 'Known competitors' },
    { key: 'key_people', label: 'Key People', type: 'array', description: 'Leadership team' },
    { key: 'description', label: 'Description', type: 'string', description: 'Company description' },
  ],
  clay: [
    { key: 'summary', label: 'AI Summary', type: 'string', description: 'AI-generated company summary' },
    { key: 'recent_news', label: 'Recent News', type: 'array', description: 'Recent company news articles' },
    { key: 'pain_points', label: 'Pain Points', type: 'array', description: 'Identified pain points' },
    { key: 'social_profiles', label: 'Social Profiles', type: 'array', description: 'Social media links' },
    { key: 'scraped_data', label: 'Scraped Data', type: 'string', description: 'Custom scraped content' },
    { key: 'ai_insights', label: 'AI Insights', type: 'string', description: 'AI-generated insights' },
  ],
};

/**
 * Input fields available from the search form (for first step in cascade)
 */
export const SEARCH_INPUT_FIELDS: ProviderField[] = [
  { key: 'query', label: 'Search Query', type: 'string', description: 'Main search query text' },
  { key: 'industry', label: 'Industry', type: 'string', description: 'Selected industry filter' },
  { key: 'location', label: 'Location', type: 'string', description: 'Geographic location filter' },
  { key: 'employee_range', label: 'Employee Range', type: 'string', description: 'Company size filter' },
  { key: 'company_name', label: 'Company Name', type: 'string', description: 'Specific company name' },
  { key: 'domain', label: 'Domain', type: 'string', description: 'Company domain/website' },
];

/**
 * Get fields that are available from previous providers in the cascade
 */
export function getFieldsFromPreviousProviders(
  cascadeProviderIds: string[],
  currentIndex: number
): ProviderFieldGroup[] {
  const groups: ProviderFieldGroup[] = [];

  // For the first step, return search input fields
  if (currentIndex === 0) {
    groups.push({
      provider: '_input',
      providerLabel: 'Search Input',
      fields: SEARCH_INPUT_FIELDS,
    });
    return groups;
  }

  // Add search input fields first
  groups.push({
    provider: '_input',
    providerLabel: 'Search Input',
    fields: SEARCH_INPUT_FIELDS,
  });

  // Add fields from each previous provider
  for (let i = 0; i < currentIndex; i++) {
    const providerId = cascadeProviderIds[i];
    const providerFields = PROVIDER_OUTPUT_FIELDS[providerId];

    if (providerFields) {
      groups.push({
        provider: providerId,
        providerLabel: getProviderLabel(providerId),
        fields: providerFields,
      });
    }
  }

  return groups;
}

/**
 * Get all available fields as a flat array (merged from all previous providers)
 */
export function getAllAvailableFields(
  cascadeProviderIds: string[],
  currentIndex: number
): ProviderField[] {
  const groups = getFieldsFromPreviousProviders(cascadeProviderIds, currentIndex);
  const seenKeys = new Set<string>();
  const fields: ProviderField[] = [];

  // Use reverse order so earlier providers win for duplicates
  for (const group of groups) {
    for (const field of group.fields) {
      if (!seenKeys.has(field.key)) {
        seenKeys.add(field.key);
        fields.push(field);
      }
    }
  }

  return fields;
}

/**
 * Get human-readable provider label
 */
function getProviderLabel(providerId: string): string {
  const labels: Record<string, string> = {
    yelp: 'Yelp',
    serper: 'Serper',
    apollo: 'Apollo',
    zoominfo: 'ZoomInfo',
    graphiq: 'GraphIQ',
    clay: 'Clay',
  };
  return labels[providerId] || providerId;
}

/**
 * Validate that a field name exists in available fields
 */
export function isValidField(
  fieldKey: string,
  cascadeProviderIds: string[],
  currentIndex: number
): boolean {
  const availableFields = getAllAvailableFields(cascadeProviderIds, currentIndex);
  return availableFields.some(f => f.key === fieldKey);
}

/**
 * Get validation warnings for a cascade step
 */
export function getStepValidationWarnings(
  trigger: string,
  triggerConfig: Record<string, any>,
  cascadeProviderIds: string[],
  currentIndex: number
): string[] {
  const warnings: string[] = [];

  if (trigger === 'on_missing_field' || trigger === 'on_field_present') {
    const fieldKey = triggerConfig?.field;

    if (!fieldKey) {
      warnings.push('No field specified for trigger condition');
    } else if (!isValidField(fieldKey, cascadeProviderIds, currentIndex)) {
      warnings.push(`Field "${fieldKey}" is not available from previous steps`);
    }
  }

  return warnings;
}

/**
 * Field requirement for cascade optimization
 */
export interface FieldRequirement {
  fieldKey: string;
  fieldLabel: string;
  priority: 'must_have' | 'nice_to_have';
}

/**
 * Get all unique output fields across all providers
 */
export function getAllOutputFields(): ProviderField[] {
  const seenKeys = new Set<string>();
  const allFields: ProviderField[] = [];

  for (const providerId of Object.keys(PROVIDER_OUTPUT_FIELDS)) {
    for (const field of PROVIDER_OUTPUT_FIELDS[providerId]) {
      if (!seenKeys.has(field.key)) {
        seenKeys.add(field.key);
        allFields.push(field);
      }
    }
  }

  return allFields.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Get which providers can supply a given field
 */
export function getProvidersForField(fieldKey: string): string[] {
  const providers: string[] = [];

  for (const [providerId, fields] of Object.entries(PROVIDER_OUTPUT_FIELDS)) {
    if (fields.some(f => f.key === fieldKey)) {
      providers.push(providerId);
    }
  }

  return providers;
}

/**
 * Optimized cascade step generated from field requirements
 */
export interface OptimizedCascadeStep {
  providerId: string;
  providerName: string;
  costPerRecord: number;
  fieldsProvided: string[];
  mustHavesCovered: string[];
  niceToHavesCovered: string[];
  trigger: 'always' | 'on_missing_field';
  triggerField?: string;
  cumulativeCost: number;
}

/**
 * Build an optimized cascade based on field requirements
 * Strategy: Use cheapest providers first, stop when must-haves are filled
 */
export function buildOptimizedCascade(
  requirements: FieldRequirement[],
  mode: 'strict' | 'complete' = 'strict'
): OptimizedCascadeStep[] {
  const mustHaves = requirements.filter(r => r.priority === 'must_have').map(r => r.fieldKey);
  const niceToHaves = requirements.filter(r => r.priority === 'nice_to_have').map(r => r.fieldKey);
  const allRequired = mode === 'complete' ? [...mustHaves, ...niceToHaves] : mustHaves;

  const cascade: OptimizedCascadeStep[] = [];
  const filledFields = new Set<string>();
  let cumulativeCost = 0;

  // Sort providers by cost (cheapest first)
  const sortedProviders = [...PROVIDER_COSTS].sort((a, b) => a.costPerRecord - b.costPerRecord);

  for (const provider of sortedProviders) {
    // Check what fields this provider can add
    const providerFields = PROVIDER_OUTPUT_FIELDS[provider.id] || [];
    const canProvide = providerFields.map(f => f.key);

    // What new fields would this provider fill?
    const newMustHaves = mustHaves.filter(f => canProvide.includes(f) && !filledFields.has(f));
    const newNiceToHaves = niceToHaves.filter(f => canProvide.includes(f) && !filledFields.has(f));
    const newFields = [...newMustHaves, ...newNiceToHaves];

    // Skip if provider doesn't add any required fields
    if (newFields.length === 0) continue;

    // Check if we still need this provider
    const missingMustHaves = mustHaves.filter(f => !filledFields.has(f));
    const missingNiceToHaves = niceToHaves.filter(f => !filledFields.has(f));

    // In strict mode, stop if all must-haves are filled
    if (mode === 'strict' && missingMustHaves.length === 0) break;

    // In complete mode, stop if everything is filled
    if (mode === 'complete' && missingMustHaves.length === 0 && missingNiceToHaves.length === 0) break;

    cumulativeCost += provider.costPerRecord;

    // Determine trigger
    let trigger: 'always' | 'on_missing_field' = 'always';
    let triggerField: string | undefined;

    if (cascade.length > 0) {
      // Use conditional trigger based on missing must-have field
      const firstMissingMustHave = newMustHaves[0];
      if (firstMissingMustHave) {
        trigger = 'on_missing_field';
        triggerField = firstMissingMustHave;
      }
    }

    cascade.push({
      providerId: provider.id,
      providerName: provider.name,
      costPerRecord: provider.costPerRecord,
      fieldsProvided: newFields,
      mustHavesCovered: newMustHaves,
      niceToHavesCovered: newNiceToHaves,
      trigger,
      triggerField,
      cumulativeCost,
    });

    // Mark fields as filled
    newFields.forEach(f => filledFields.add(f));
  }

  return cascade;
}

/**
 * Calculate cost estimate for a cascade
 */
export function calculateCascadeCost(cascade: OptimizedCascadeStep[]): {
  minCost: number;
  maxCost: number;
  avgCost: number;
} {
  if (cascade.length === 0) {
    return { minCost: 0, maxCost: 0, avgCost: 0 };
  }

  // Min cost: only first provider runs
  const minCost = cascade[0].costPerRecord;

  // Max cost: all providers run
  const maxCost = cascade.reduce((sum, step) => sum + step.costPerRecord, 0);

  // Avg cost: estimate ~60% of cascades need fallback
  const avgCost = minCost + (maxCost - minCost) * 0.4;

  return { minCost, maxCost, avgCost };
}

/**
 * Field Requirements Template
 */
export interface FieldTemplate {
  id: string;
  name: string;
  description: string;
  requirements: FieldRequirement[];
  createdAt: string;
}

const TEMPLATES_STORAGE_KEY = 'enrichment_field_templates';

/**
 * Default built-in templates
 */
export const DEFAULT_TEMPLATES: FieldTemplate[] = [
  {
    id: 'basic_company',
    name: 'Basic Company Info',
    description: 'Essential company details for outreach',
    requirements: [
      { fieldKey: 'name', fieldLabel: 'Company Name', priority: 'must_have' },
      { fieldKey: 'website', fieldLabel: 'Website URL', priority: 'must_have' },
      { fieldKey: 'phone', fieldLabel: 'Phone Number', priority: 'must_have' },
      { fieldKey: 'address', fieldLabel: 'Address', priority: 'nice_to_have' },
    ],
    createdAt: '2024-01-01',
  },
  {
    id: 'firmographics',
    name: 'Full Firmographics',
    description: 'Company size, revenue, and industry data',
    requirements: [
      { fieldKey: 'name', fieldLabel: 'Company Name', priority: 'must_have' },
      { fieldKey: 'domain', fieldLabel: 'Domain', priority: 'must_have' },
      { fieldKey: 'employee_count', fieldLabel: 'Employee Count', priority: 'must_have' },
      { fieldKey: 'revenue', fieldLabel: 'Revenue', priority: 'must_have' },
      { fieldKey: 'industry', fieldLabel: 'Industry', priority: 'nice_to_have' },
      { fieldKey: 'founded_year', fieldLabel: 'Founded Year', priority: 'nice_to_have' },
    ],
    createdAt: '2024-01-01',
  },
  {
    id: 'local_business',
    name: 'Local Business',
    description: 'For SMB brick-and-mortar prospecting',
    requirements: [
      { fieldKey: 'name', fieldLabel: 'Company Name', priority: 'must_have' },
      { fieldKey: 'phone', fieldLabel: 'Phone Number', priority: 'must_have' },
      { fieldKey: 'address', fieldLabel: 'Address', priority: 'must_have' },
      { fieldKey: 'website', fieldLabel: 'Website URL', priority: 'nice_to_have' },
      { fieldKey: 'yelp_rating', fieldLabel: 'Yelp Rating', priority: 'nice_to_have' },
      { fieldKey: 'hours', fieldLabel: 'Business Hours', priority: 'nice_to_have' },
    ],
    createdAt: '2024-01-01',
  },
  {
    id: 'local_with_reviews',
    name: 'Local + Reviews',
    description: 'SMB with Yelp & Google ratings combined',
    requirements: [
      { fieldKey: 'name', fieldLabel: 'Company Name', priority: 'must_have' },
      { fieldKey: 'phone', fieldLabel: 'Phone Number', priority: 'must_have' },
      { fieldKey: 'address', fieldLabel: 'Address', priority: 'must_have' },
      { fieldKey: 'yelp_rating', fieldLabel: 'Yelp Rating', priority: 'must_have' },
      { fieldKey: 'rating', fieldLabel: 'Google Rating', priority: 'must_have' },
      { fieldKey: 'yelp_review_count', fieldLabel: 'Yelp Reviews', priority: 'nice_to_have' },
      { fieldKey: 'reviews_count', fieldLabel: 'Google Reviews', priority: 'nice_to_have' },
      { fieldKey: 'price_level', fieldLabel: 'Price Level', priority: 'nice_to_have' },
    ],
    createdAt: '2024-01-01',
  },
  {
    id: 'contact_enrichment',
    name: 'Contact Enrichment',
    description: 'Email and phone for direct outreach',
    requirements: [
      { fieldKey: 'email', fieldLabel: 'Email', priority: 'must_have' },
      { fieldKey: 'phone', fieldLabel: 'Phone', priority: 'must_have' },
      { fieldKey: 'linkedin_url', fieldLabel: 'LinkedIn URL', priority: 'nice_to_have' },
      { fieldKey: 'direct_dial', fieldLabel: 'Direct Dial', priority: 'nice_to_have' },
    ],
    createdAt: '2024-01-01',
  },
];

/**
 * Get all saved templates (built-in + user-created)
 */
export function getFieldTemplates(): FieldTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;

  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    const userTemplates: FieldTemplate[] = stored ? JSON.parse(stored) : [];
    return [...DEFAULT_TEMPLATES, ...userTemplates];
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

/**
 * Save a new template
 */
export function saveFieldTemplate(template: Omit<FieldTemplate, 'id' | 'createdAt'>): FieldTemplate {
  const newTemplate: FieldTemplate = {
    ...template,
    id: `custom_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      const userTemplates: FieldTemplate[] = stored ? JSON.parse(stored) : [];
      userTemplates.push(newTemplate);
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(userTemplates));
    } catch (e) {
      console.error('Failed to save template:', e);
    }
  }

  return newTemplate;
}

/**
 * Delete a user-created template
 */
export function deleteFieldTemplate(templateId: string): boolean {
  // Can't delete built-in templates
  if (DEFAULT_TEMPLATES.some(t => t.id === templateId)) return false;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      const userTemplates: FieldTemplate[] = stored ? JSON.parse(stored) : [];
      const filtered = userTemplates.filter(t => t.id !== templateId);
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
