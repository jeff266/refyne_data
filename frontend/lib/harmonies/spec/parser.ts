import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import jsonata from 'jsonata';
import { createHash } from 'crypto';
import {
  HarmonySpec,
  HarmonyValidationResult,
  HarmonyValidationError,
  HarmonyValidationWarning,
  ValidatedHarmony,
  validateHarmonySpec,
  validateFieldPaths,
} from './schema';

/**
 * Result of parsing a Harmony YAML document.
 */
export interface ParseResult {
  success: boolean;
  harmony?: ValidatedHarmony;
  errors: HarmonyValidationError[];
  warnings: HarmonyValidationWarning[];
  raw?: unknown; // Raw parsed YAML for debugging
}

/**
 * JSONata expression validation result.
 */
interface ExpressionValidation {
  valid: boolean;
  expression: string;
  error?: string;
  location?: { path: string; ruleId?: string };
}

/**
 * Parse and validate a Harmony YAML document.
 *
 * @param yaml - YAML string to parse
 * @param options - Optional parsing options
 * @returns ParseResult with validated Harmony or errors
 */
export function parseHarmony(
  yaml: string,
  options: {
    source?: 'library' | 'custom';
    org_id?: string;
    validateExpressions?: boolean;
    validateFieldPaths?: boolean;
  } = {}
): ParseResult {
  const {
    source = 'custom',
    org_id,
    validateExpressions = true,
    validateFieldPaths: shouldValidateFields = true,
  } = options;

  const errors: HarmonyValidationError[] = [];
  const warnings: HarmonyValidationWarning[] = [];

  // Step 1: Parse YAML
  let raw: unknown;
  try {
    raw = parseYAML(yaml);
  } catch (err) {
    return {
      success: false,
      errors: [
        {
          path: '',
          message: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
          code: 'yaml_parse_error',
        },
      ],
      warnings: [],
    };
  }

  // Step 2: Validate against schema
  const schemaResult = validateHarmonySpec(raw);

  if (!schemaResult.valid) {
    return {
      success: false,
      errors: schemaResult.errors,
      warnings: schemaResult.warnings,
      raw,
    };
  }

  const spec = schemaResult.harmony!;
  warnings.push(...schemaResult.warnings);

  // Step 3: Validate JSONata expressions
  if (validateExpressions) {
    const expressionErrors = validateAllExpressions(spec);
    for (const exprError of expressionErrors) {
      if (!exprError.valid) {
        errors.push({
          path: exprError.location?.path ?? 'unknown',
          message: `Invalid JSONata expression: ${exprError.error}`,
          code: 'invalid_jsonata',
        });
      }
    }
  }

  // Step 4: Validate field paths
  if (shouldValidateFields) {
    const fieldResult = validateFieldPaths(
      spec.applies_to.fields,
      spec.applies_to.entity
    );

    if (!fieldResult.valid) {
      // Warnings, not errors - allow custom fields
      for (const field of fieldResult.invalidFields) {
        warnings.push({
          path: `applies_to.fields`,
          message: `Field '${field}' is not a standard canonical field`,
          suggestion: 'This may be intentional for custom fields',
        });
      }
    }
  }

  // If we have errors, fail
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
      raw,
    };
  }

  // Step 5: Generate hash for cache invalidation
  const hash = createHash('sha256').update(yaml).digest('hex');

  // Success!
  return {
    success: true,
    harmony: {
      spec,
      source,
      org_id,
      compiled_at: new Date().toISOString(),
      hash,
    },
    errors: [],
    warnings,
    raw,
  };
}

/**
 * Validate all JSONata expressions in a Harmony spec.
 */
function validateAllExpressions(spec: HarmonySpec): ExpressionValidation[] {
  const results: ExpressionValidation[] = [];

  for (const rule of spec.rules) {
    // Validate 'when' condition if present
    if (rule.when) {
      results.push(
        validateExpression(rule.when, {
          path: `rules.${rule.id}.when`,
          ruleId: rule.id,
        })
      );
    }

    // Validate 'transform' expression
    results.push(
      validateExpression(rule.transform, {
        path: `rules.${rule.id}.transform`,
        ruleId: rule.id,
      })
    );
  }

  return results;
}

/**
 * Validate a single JSONata expression.
 */
function validateExpression(
  expression: string,
  location: { path: string; ruleId?: string }
): ExpressionValidation {
  try {
    // Attempt to compile the expression
    // This catches syntax errors without executing
    jsonata(expression);

    return {
      valid: true,
      expression,
      location,
    };
  } catch (err: unknown) {
    // JSONata throws objects with 'message' property
    let errorMessage: string;
    if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = String((err as { message: unknown }).message);
    } else if (err instanceof Error) {
      errorMessage = err.message;
    } else {
      errorMessage = String(err);
    }

    return {
      valid: false,
      expression,
      error: errorMessage,
      location,
    };
  }
}

/**
 * Parse multiple Harmony YAML documents from a directory or array.
 */
export function parseHarmonies(
  yamls: Array<{ name: string; content: string }>,
  options: {
    source?: 'library' | 'custom';
    org_id?: string;
    stopOnError?: boolean;
  } = {}
): {
  harmonies: ValidatedHarmony[];
  errors: Array<{ name: string; errors: HarmonyValidationError[] }>;
  warnings: Array<{ name: string; warnings: HarmonyValidationWarning[] }>;
} {
  const { stopOnError = false, ...parseOptions } = options;

  const harmonies: ValidatedHarmony[] = [];
  const allErrors: Array<{ name: string; errors: HarmonyValidationError[] }> = [];
  const allWarnings: Array<{ name: string; warnings: HarmonyValidationWarning[] }> = [];

  for (const { name, content } of yamls) {
    const result = parseHarmony(content, parseOptions);

    if (result.warnings.length > 0) {
      allWarnings.push({ name, warnings: result.warnings });
    }

    if (result.success && result.harmony) {
      harmonies.push(result.harmony);
    } else {
      allErrors.push({ name, errors: result.errors });

      if (stopOnError) {
        break;
      }
    }
  }

  return { harmonies, errors: allErrors, warnings: allWarnings };
}

/**
 * Serialize a Harmony spec back to YAML.
 * Useful for editing and saving.
 */
export function serializeHarmony(spec: HarmonySpec): string {
  return stringifyYAML(spec, {
    indent: 2,
    lineWidth: 100,
  });
}

/**
 * Create a new Harmony spec with sensible defaults.
 */
export function createHarmonyTemplate(
  id: string,
  name: string,
  options: {
    category?: HarmonySpec['category'];
    author?: string;
    fields?: string[];
  } = {}
): HarmonySpec {
  const { category = 'custom', author = 'user', fields = ['company.name'] } = options;

  return {
    id,
    version: '1.0.0',
    name,
    description: `Normalizes ${fields.join(', ')}`,
    category,
    author,
    applies_to: {
      fields,
    },
    sources: [],
    rules: [
      {
        id: 'default-rule',
        description: 'Default transformation rule',
        transform: 'value', // Pass-through by default
      },
    ],
    tests: [
      {
        name: 'Basic test',
        input: 'Test Input',
        expected: 'Test Input',
      },
    ],
    on_error: 'fail-silent-log',
    default_enabled: true,
  };
}

/**
 * Get the unique identifier for a Harmony (id@version).
 */
export function getHarmonyIdentifier(spec: HarmonySpec): string {
  return `${spec.id}@${spec.version}`;
}

/**
 * Compare two Harmony versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareHarmonyVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const [main, prerelease] = v.split('-');
    const parts = main.split('.').map(Number);
    return { parts, prerelease };
  };

  const va = parseVersion(a);
  const vb = parseVersion(b);

  // Compare major, minor, patch
  for (let i = 0; i < 3; i++) {
    if (va.parts[i] < vb.parts[i]) return -1;
    if (va.parts[i] > vb.parts[i]) return 1;
  }

  // Compare prerelease (no prerelease > prerelease)
  if (!va.prerelease && vb.prerelease) return 1;
  if (va.prerelease && !vb.prerelease) return -1;
  if (va.prerelease && vb.prerelease) {
    return va.prerelease.localeCompare(vb.prerelease);
  }

  return 0;
}
