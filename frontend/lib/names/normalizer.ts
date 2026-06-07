import {
  lookupRegistry,
  addToRegistry,
  queueForReview,
  tokenizeCompanyName,
  RegistryType
} from './registry';

export interface NormalizeNameOptions {
  /**
   * Organization ID for registry lookups and storage
   */
  orgId: string;

  /**
   * How to handle suffixes (e.g., Inc, Corp, Jr, Sr)
   * - 'remove': Remove common suffixes
   * - 'keep': Keep all suffixes
   * - 'standardize': Convert to standard forms (e.g., "Inc." → "Inc")
   */
  suffixTreatment?: 'remove' | 'keep' | 'standardize';

  /**
   * Preferred casing style
   * - 'title': Title Case (e.g., "John Smith")
   * - 'upper': UPPER CASE
   * - 'lower': lower case
   * - 'smart': Smart casing based on context
   */
  casingPreference?: 'title' | 'upper' | 'lower' | 'smart';

  /**
   * Whether to automatically learn from high-confidence normalizations
   */
  autoLearn?: boolean;

  /**
   * Minimum confidence threshold for auto-learning (0-1)
   * Below this, suggestions are queued for review
   */
  learningThreshold?: number;

  /**
   * Additional context for normalization (e.g., industry, region)
   */
  context?: Record<string, any>;
}

export interface NormalizeNameResult {
  /**
   * The normalized output
   */
  output: string;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * How the normalization was performed
   */
  source: 'registry' | 'rules' | 'passthrough';

  /**
   * Whether this was queued for manual review
   */
  queuedForReview?: boolean;

  /**
   * ID of the review queue entry if queued
   */
  reviewId?: string;

  /**
   * Applied transformations for debugging
   */
  transformations?: string[];
}

// Company suffix patterns
const COMPANY_SUFFIXES = {
  'incorporated': 'Inc',
  'inc.': 'Inc',
  'inc': 'Inc',
  'corporation': 'Corp',
  'corp.': 'Corp',
  'corp': 'Corp',
  'limited': 'Ltd',
  'ltd.': 'Ltd',
  'ltd': 'Ltd',
  'llc': 'LLC',
  'l.l.c': 'LLC',
  'l.l.c.': 'LLC',
  'plc': 'PLC',
  'p.l.c': 'PLC',
  'company': 'Co',
  'co.': 'Co',
  'co': 'Co',
  'group': 'Group',
  'holdings': 'Holdings',
  'international': 'International',
  'technologies': 'Technologies',
  'technology': 'Technology',
  'tech': 'Tech',
  'solutions': 'Solutions',
  'services': 'Services',
  'systems': 'Systems',
  'enterprises': 'Enterprises',
  'industries': 'Industries'
};

// Personal name suffixes
const PERSONAL_SUFFIXES = {
  'jr.': 'Jr',
  'jr': 'Jr',
  'sr.': 'Sr',
  'sr': 'Sr',
  'ii': 'II',
  'iii': 'III',
  'iv': 'IV',
  'v': 'V',
  'esq.': 'Esq',
  'esq': 'Esq',
  'phd': 'PhD',
  'ph.d': 'PhD',
  'ph.d.': 'PhD',
  'md': 'MD',
  'm.d': 'MD',
  'm.d.': 'MD'
};

/**
 * Normalize a company name
 * @param companyName - The company name to normalize
 * @param options - Normalization options (orgId is required)
 * @returns Normalized name result
 */
export async function normalizeCompanyName(
  companyName: string,
  options: NormalizeNameOptions
): Promise<NormalizeNameResult> {
  const {
    suffixTreatment = 'standardize',
    casingPreference = 'title',
    autoLearn = true,
    learningThreshold = 0.85,
    context = {}
  } = options;

  const transformations: string[] = [];
  let currentName = companyName.trim();

  if (!currentName) {
    return {
      output: '',
      confidence: 0,
      source: 'passthrough',
      transformations: ['empty input']
    };
  }

  // Step 1: Try registry lookup first
  const canonical = await lookupRegistry(options.orgId, 'company', currentName);

  if (canonical) {
    transformations.push('registry lookup');
    return {
      output: canonical,
      confidence: 1.0,
      source: 'registry',
      transformations
    };
  }

  // Step 2: Apply transformation rules
  transformations.push('applying rules');

  // Clean up whitespace and common issues
  currentName = currentName.replace(/\s+/g, ' ').trim();
  transformations.push('whitespace normalized');

  // Handle all-caps names
  if (currentName === currentName.toUpperCase() && currentName.length > 3) {
    currentName = toTitleCase(currentName);
    transformations.push('converted from all caps');
  }

  // Handle suffix treatment
  currentName = handleCompanySuffix(currentName, suffixTreatment, transformations);

  // Apply casing preference
  currentName = applyCasing(currentName, casingPreference, transformations);

  // Calculate confidence based on transformations
  const confidence = calculateConfidence(transformations, companyName, currentName);

  // Step 3: Auto-learn or queue for review
  let queuedForReview = false;
  let reviewId: string | undefined;

  if (confidence >= learningThreshold && autoLearn) {
    // High confidence - add to registry automatically
    await addToRegistry(
      options.orgId,
      'company',
      companyName,
      currentName,
      'ai_suggestion',
      { ...context, transformations, confidence }
    );
    transformations.push('auto-learned');
  } else if (confidence < learningThreshold) {
    // Low confidence - queue for manual review
    await queueForReview(
      options.orgId,
      'company',
      companyName,
      currentName,
      'low_confidence',
      { ...context, transformations, confidence }
    );
    queuedForReview = true;
    transformations.push('queued for review');
  }

  return {
    output: currentName,
    confidence,
    source: 'rules',
    queuedForReview,
    reviewId,
    transformations
  };
}

/**
 * Normalize a contact name token (first or last name)
 * @param nameToken - The name token to normalize
 * @param type - Whether this is a first or last name
 * @param options - Normalization options (orgId is required)
 * @returns Normalized name result
 */
export async function normalizeContactToken(
  nameToken: string,
  type: 'first_name' | 'last_name',
  options: NormalizeNameOptions
): Promise<NormalizeNameResult> {
  const {
    suffixTreatment = 'standardize',
    casingPreference = 'title',
    autoLearn = true,
    learningThreshold = 0.85,
    context = {}
  } = options;

  const transformations: string[] = [];
  let currentName = nameToken.trim();

  if (!currentName) {
    return {
      output: '',
      confidence: 0,
      source: 'passthrough',
      transformations: ['empty input']
    };
  }

  // Step 1: Try registry lookup first
  const registryType: RegistryType = type === 'first_name' ? 'contact_first' : 'contact_last';
  const canonical = await lookupRegistry(options.orgId, registryType, currentName);

  if (canonical) {
    transformations.push('registry lookup');
    return {
      output: canonical,
      confidence: 1.0,
      source: 'registry',
      transformations
    };
  }

  // Step 2: Apply transformation rules
  transformations.push('applying rules');

  // Clean up whitespace
  currentName = currentName.replace(/\s+/g, ' ').trim();
  transformations.push('whitespace normalized');

  // Handle all-caps names
  if (currentName === currentName.toUpperCase() && currentName.length > 2) {
    currentName = toTitleCase(currentName);
    transformations.push('converted from all caps');
  }

  // Handle all-lowercase names
  if (currentName === currentName.toLowerCase()) {
    currentName = toTitleCase(currentName);
    transformations.push('converted from all lowercase');
  }

  // Apply contact name rules (Mc/Mac, O', van, etc.)
  if (type === 'last_name') {
    currentName = applyContactNameRules(currentName, transformations);
  } else {
    // First name - simpler rules
    currentName = toTitleCase(currentName);
  }

  // Handle suffix treatment for personal suffixes
  if (suffixTreatment !== 'keep') {
    currentName = handlePersonalSuffix(currentName, suffixTreatment, transformations);
  }

  // Calculate confidence
  const confidence = calculateConfidence(transformations, nameToken, currentName);

  // Step 3: Auto-learn or queue for review
  let queuedForReview = false;
  let reviewId: string | undefined;

  if (confidence >= learningThreshold && autoLearn) {
    await addToRegistry(
      options.orgId,
      registryType,
      nameToken,
      currentName,
      'ai_suggestion',
      { ...context, transformations, confidence }
    );
    transformations.push('auto-learned');
  } else if (confidence < learningThreshold) {
    await queueForReview(
      options.orgId,
      registryType,
      nameToken,
      currentName,
      'low_confidence',
      { ...context, transformations, confidence }
    );
    queuedForReview = true;
    transformations.push('queued for review');
  }

  return {
    output: currentName,
    confidence,
    source: 'rules',
    queuedForReview,
    reviewId,
    transformations
  };
}

/**
 * Apply contact name rules (handles Mc/Mac, O', van/von/de/di/du, ibn, al-)
 * @param name - The name to apply rules to
 * @param transformations - Array to track transformations
 * @returns Transformed name
 */
export function applyContactNameRules(
  name: string,
  transformations: string[]
): string {
  let result = name;

  // Handle Mc prefix (McDonald → McDonald)
  if (/^mc/i.test(result) && result.length > 3) {
    const prefix = 'Mc';
    const rest = result.substring(2);
    result = prefix + rest.charAt(0).toUpperCase() + rest.substring(1).toLowerCase();
    transformations.push('Mc prefix handling');
  }
  // Handle Mac prefix (MacDonald → MacDonald)
  else if (/^mac/i.test(result) && result.length > 4) {
    const prefix = 'Mac';
    const rest = result.substring(3);
    result = prefix + rest.charAt(0).toUpperCase() + rest.substring(1).toLowerCase();
    transformations.push('Mac prefix handling');
  }
  // Handle O' prefix (O'Brien → O'Brien)
  else if (/^o'/i.test(result) && result.length > 3) {
    const rest = result.substring(2);
    result = "O'" + rest.charAt(0).toUpperCase() + rest.substring(1).toLowerCase();
    transformations.push("O' prefix handling");
  }
  // Handle van/von/de/di/du/da prefixes (van der Berg → van der Berg)
  else if (/^(van|von|de|di|du|da|del|della|le|la)\s/i.test(result)) {
    const parts = result.split(/\s+/);
    result = parts.map((part, index) => {
      const lower = part.toLowerCase();
      // Keep prefixes lowercase, capitalize main surname
      if (index < parts.length - 1 && ['van', 'von', 'de', 'di', 'du', 'da', 'del', 'della', 'le', 'la', 'der'].includes(lower)) {
        return lower;
      }
      return part.charAt(0).toUpperCase() + part.substring(1).toLowerCase();
    }).join(' ');
    transformations.push('European name prefix handling');
  }
  // Handle ibn prefix (ibn Saud → ibn Saud)
  else if (/^ibn\s/i.test(result)) {
    const parts = result.split(/\s+/);
    result = 'ibn ' + parts.slice(1).map(p =>
      p.charAt(0).toUpperCase() + p.substring(1).toLowerCase()
    ).join(' ');
    transformations.push('ibn prefix handling');
  }
  // Handle al- prefix (al-Assad → al-Assad)
  else if (/^al[-\s]/i.test(result)) {
    const rest = result.substring(3);
    result = 'al-' + rest.charAt(0).toUpperCase() + rest.substring(1).toLowerCase();
    transformations.push('al- prefix handling');
  }
  // Handle el- prefix (el-Sisi → el-Sisi)
  else if (/^el[-\s]/i.test(result)) {
    const rest = result.substring(3);
    result = 'el-' + rest.charAt(0).toUpperCase() + rest.substring(1).toLowerCase();
    transformations.push('el- prefix handling');
  }
  // Default title case
  else {
    result = toTitleCase(result);
  }

  return result;
}

/**
 * Calculate confidence score based on transformations applied
 * @param transformations - List of transformations applied
 * @param original - Original input
 * @param normalized - Normalized output
 * @returns Confidence score (0-1)
 */
export function calculateConfidence(
  transformations: string[],
  original: string,
  normalized: string
): number {
  let confidence = 1.0;

  // Penalize based on number and type of transformations
  if (transformations.includes('converted from all caps')) {
    confidence -= 0.1;
  }

  if (transformations.includes('converted from all lowercase')) {
    confidence -= 0.05;
  }

  // Reward if only minor transformations
  if (transformations.length <= 2 && transformations.includes('whitespace normalized')) {
    confidence = 0.95;
  }

  // Penalize if many transformations applied
  if (transformations.length > 5) {
    confidence -= 0.15;
  }

  // Penalize if output is very different from input
  const similarity = calculateStringSimilarity(original.toLowerCase(), normalized.toLowerCase());
  if (similarity < 0.7) {
    confidence -= 0.2;
  }

  // Ensure confidence is in valid range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Convert string to Title Case
 * @param str - String to convert
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Handle company suffix based on treatment option
 * @param name - Company name
 * @param treatment - Suffix treatment option
 * @param transformations - Array to track transformations
 * @returns Transformed name
 */
function handleCompanySuffix(
  name: string,
  treatment: 'remove' | 'keep' | 'standardize',
  transformations: string[]
): string {
  if (treatment === 'keep') {
    return name;
  }

  let result = name;
  const lowerName = name.toLowerCase();

  // Check for suffixes
  for (const [variant, standard] of Object.entries(COMPANY_SUFFIXES)) {
    const patterns = [
      new RegExp(`\\s+${variant.replace('.', '\\.')}\\s*$`, 'i'),
      new RegExp(`\\s+${variant.replace('.', '\\.')},\\s*$`, 'i')
    ];

    for (const pattern of patterns) {
      if (pattern.test(result)) {
        if (treatment === 'remove') {
          result = result.replace(pattern, '').trim();
          transformations.push(`removed suffix: ${variant}`);
        } else if (treatment === 'standardize') {
          result = result.replace(pattern, ` ${standard}`).trim();
          transformations.push(`standardized suffix: ${variant} → ${standard}`);
        }
        return result;
      }
    }
  }

  return result;
}

/**
 * Handle personal suffix based on treatment option
 * @param name - Person name
 * @param treatment - Suffix treatment option
 * @param transformations - Array to track transformations
 * @returns Transformed name
 */
function handlePersonalSuffix(
  name: string,
  treatment: 'remove' | 'keep' | 'standardize',
  transformations: string[]
): string {
  if (treatment === 'keep') {
    return name;
  }

  let result = name;

  // Check for personal suffixes
  for (const [variant, standard] of Object.entries(PERSONAL_SUFFIXES)) {
    const patterns = [
      new RegExp(`\\s+${variant.replace('.', '\\.')}\\s*$`, 'i'),
      new RegExp(`\\s+${variant.replace('.', '\\.')},\\s*$`, 'i')
    ];

    for (const pattern of patterns) {
      if (pattern.test(result)) {
        if (treatment === 'remove') {
          result = result.replace(pattern, '').trim();
          transformations.push(`removed suffix: ${variant}`);
        } else if (treatment === 'standardize') {
          result = result.replace(pattern, ` ${standard}`).trim();
          transformations.push(`standardized suffix: ${variant} → ${standard}`);
        }
        return result;
      }
    }
  }

  return result;
}

/**
 * Apply casing preference to a name
 * @param name - Name to apply casing to
 * @param preference - Casing preference
 * @param transformations - Array to track transformations
 * @returns Transformed name
 */
function applyCasing(
  name: string,
  preference: 'title' | 'upper' | 'lower' | 'smart',
  transformations: string[]
): string {
  switch (preference) {
    case 'upper':
      transformations.push('applied uppercase');
      return name.toUpperCase();

    case 'lower':
      transformations.push('applied lowercase');
      return name.toLowerCase();

    case 'smart':
    case 'title':
    default:
      // Smart/title casing - already handled in main logic
      return name;
  }
}

/**
 * Calculate string similarity (simple Levenshtein-based ratio)
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity ratio (0-1)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Normalize a full contact name (first + last)
 * @param firstName - First name
 * @param lastName - Last name
 * @param options - Normalization options (orgId is required)
 * @returns Object with normalized first and last names
 */
export async function normalizeContactName(
  firstName: string,
  lastName: string,
  options: NormalizeNameOptions
): Promise<{
  firstName: NormalizeNameResult;
  lastName: NormalizeNameResult;
}> {
  const [firstResult, lastResult] = await Promise.all([
    normalizeContactToken(firstName, 'first_name', options),
    normalizeContactToken(lastName, 'last_name', options)
  ]);

  return {
    firstName: firstResult,
    lastName: lastResult
  };
}
