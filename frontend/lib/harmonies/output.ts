/**
 * Harmony Output Format Extraction
 *
 * Handles extraction of specific fields from structured harmony outputs.
 * When harmonies return objects like { name: 'California', abbreviation: 'CA' },
 * this module extracts the field specified by the org's output_format preference.
 */

export interface OutputFormatOption {
  key: string;
  label: string;
  default?: boolean;
}

/**
 * Extracts the appropriate field from a harmony output based on format preference.
 *
 * @param rawOutput - The harmony transformation result (string or object)
 * @param outputFormat - Selected format key ('default', 'abbreviation', 'name', etc.)
 * @param availableFormats - Available format options declared by the harmony
 * @returns Extracted string value for writing to HubSpot
 */
export function extractHarmonyOutput(
  rawOutput: unknown,
  outputFormat: string,
  availableFormats: OutputFormatOption[]
): string {
  // If raw output is already a string, return as-is
  if (typeof rawOutput === 'string') return rawOutput;

  // If not an object, coerce to string
  if (typeof rawOutput !== 'object' || rawOutput === null) {
    return String(rawOutput);
  }

  const obj = rawOutput as Record<string, unknown>;

  // If output_format is 'default' or not set, find the declared default
  if (!outputFormat || outputFormat === 'default') {
    const defaultFormat = availableFormats.find((f) => f.default);
    if (defaultFormat && obj[defaultFormat.key] !== undefined) {
      return String(obj[defaultFormat.key]);
    }
    // Fallback: return first key value
    const firstValue = Object.values(obj)[0];
    return firstValue !== undefined ? String(firstValue) : '';
  }

  // Return the selected format key
  if (obj[outputFormat] !== undefined) {
    return String(obj[outputFormat]);
  }

  // Key not found in output: log warning, fall back to default
  console.warn(
    `[Harmony Output] format '${outputFormat}' not found in output. Available keys: ${Object.keys(obj).join(', ')}. Falling back to default.`
  );
  const defaultFormat = availableFormats.find((f) => f.default);
  if (defaultFormat && obj[defaultFormat.key] !== undefined) {
    return String(obj[defaultFormat.key]);
  }
  const firstValue = Object.values(obj)[0];
  return firstValue !== undefined ? String(firstValue) : '';
}

/**
 * Gets the effective output format for a harmony, considering org preferences.
 *
 * @param harmonyId - Harmony ID
 * @param orgId - Organization ID
 * @param harmonySettings - Harmony record with output_format and is_preset fields
 * @param orgSettings - Optional org-specific settings from harmony_org_settings
 * @returns The effective output format key to use
 */
export function getEffectiveOutputFormat(
  harmonyId: string,
  orgId: string,
  harmonySettings: { output_format?: string; is_preset?: boolean } | null,
  orgSettings?: { output_format?: string } | null
): string {
  // For library/preset harmonies, check org settings first
  if (harmonySettings?.is_preset && orgSettings?.output_format) {
    return orgSettings.output_format;
  }

  // Otherwise use harmony's own setting
  return harmonySettings?.output_format || 'default';
}
