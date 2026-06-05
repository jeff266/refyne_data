/**
 * Enum Validator - Validates harmony canonical values against HubSpot enum fields
 *
 * Used in harmony reference data editor and normalize preview to warn users
 * when canonical values won't be accepted by HubSpot's enumeration fields.
 */

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description?: string;
  hubspotDefined: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface EnumValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates a value against a HubSpot property's enum options.
 *
 * @param value - The canonical value to validate
 * @param property - The HubSpot property definition (from hubspot_properties_cache)
 * @returns Validation result with valid boolean and optional reason
 *
 * @example
 * const result = validateEnumValue('ABA Therapy', industryProperty);
 * if (!result.valid) {
 *   console.log(result.reason); // "Not a valid option for Industry"
 * }
 */
export function validateEnumValue(
  value: string,
  property: HubSpotProperty
): EnumValidationResult {
  // Only validate enumeration fields
  if (property.type !== 'enumeration') {
    return { valid: true };
  }

  // If no options defined, can't validate (assume valid)
  const validValues = property.options?.map(o => o.value) ?? [];
  if (validValues.length === 0) {
    return { valid: true };
  }

  // Check if value is in the accepted options
  const isValid = validValues.includes(value);

  return {
    valid: isValid,
    reason: isValid ? undefined : `Not a valid option for ${property.label}`,
  };
}

/**
 * Validates multiple values against a HubSpot property.
 * Useful for batch validation in reference data tables.
 *
 * @param values - Array of canonical values to validate
 * @param property - The HubSpot property definition
 * @returns Map of value to validation result
 */
export function validateEnumValues(
  values: string[],
  property: HubSpotProperty
): Map<string, EnumValidationResult> {
  const results = new Map<string, EnumValidationResult>();

  for (const value of values) {
    results.set(value, validateEnumValue(value, property));
  }

  return results;
}

/**
 * Gets the accepted enum option values for a property.
 * Returns empty array if not an enum field or no options defined.
 */
export function getAcceptedEnumValues(property: HubSpotProperty): string[] {
  if (property.type !== 'enumeration') {
    return [];
  }
  return property.options?.map(o => o.value) ?? [];
}
