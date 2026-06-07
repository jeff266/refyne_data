import { supabaseAdmin } from '@/lib/db/admin-client';

export type RegistryType =
  | 'company'
  | 'contact_first'
  | 'contact_last'
  | 'contact_token';

export interface RegistryEntry {
  input_token: string;
  canonical_form: string;
  registry_type: RegistryType;
  org_id: string | null;
  source: 'seed' | 'admin_correction' | 'hubspot_edit' | 'ai_suggestion' | 'manual';
  confidence: number;
  status: 'active' | 'pending_review' | 'rejected';
  occurrence_count?: number;
  last_seen_at?: string;
}

export interface QueuedReview {
  id: string;
  org_id: string;
  registry_type: RegistryType;
  input_token: string;
  suggested_canonical: string;
  trigger_type: string;
  trigger_context?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
}

/**
 * Look up a name in the registry using Supabase RPC
 * Checks org-specific registry first, then falls back to global registry
 * @param orgId - The organization ID
 * @param type - The registry type (company, contact_first, contact_last, contact_token)
 * @param token - The input token to look up
 * @returns Canonical form or null if not found
 */
export async function lookupRegistry(
  orgId: string,
  type: RegistryType,
  token: string
): Promise<string | null> {
  try {
    const normalizedToken = token.toLowerCase().trim();

    if (!normalizedToken) {
      return null;
    }

    // Call Supabase RPC function to lookup in registry
    const { data, error } = await supabaseAdmin.rpc('lookup_name_registry', {
      p_org_id: orgId,
      p_registry_type: type,
      p_input_token: normalizedToken
    });

    if (error) {
      console.error('Registry lookup error:', error);
      return null;
    }

    // RPC returns TEXT (string | null)
    return data;
  } catch (error) {
    console.error('Registry lookup exception:', error);
    return null;
  }
}

/**
 * Batch lookup names in the registry for performance optimization
 * Fetches all tokens at once instead of calling lookupRegistry() in a loop
 * @param orgId - The organization ID
 * @param type - The registry type (company, contact_first, contact_last, contact_token)
 * @param tokens - Array of input tokens to look up
 * @returns Map where key = input_token (original case), value = canonical_form
 */
export async function batchLookupRegistry(
  orgId: string,
  type: RegistryType,
  tokens: string[]
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  try {
    // Normalize all tokens to lowercase trimmed
    const normalizedTokens = tokens
      .map(token => token.toLowerCase().trim())
      .filter(token => token.length > 0);

    if (normalizedTokens.length === 0) {
      return resultMap;
    }

    // Remove duplicates for efficient query
    const uniqueTokens = Array.from(new Set(normalizedTokens));

    // Step 1: Fetch org-specific entries first
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('name_registry')
      .select('input_token, canonical_form')
      .eq('org_id', orgId)
      .eq('registry_type', type)
      .eq('status', 'active')
      .in('input_token', uniqueTokens);

    if (orgError) {
      console.error('Batch registry lookup error (org entries):', orgError);
      // Continue to global lookup even if org lookup fails
    }

    // Build initial map from org entries
    const orgTokensFound = new Set<string>();
    if (orgData) {
      for (const entry of orgData) {
        resultMap.set(entry.input_token, entry.canonical_form);
        orgTokensFound.add(entry.input_token);
      }
    }

    // Step 2: Find tokens not found in org entries
    const missingTokens = uniqueTokens.filter(token => !orgTokensFound.has(token));

    if (missingTokens.length > 0) {
      // Fetch global entries for missing tokens
      const { data: globalData, error: globalError } = await supabaseAdmin
        .from('name_registry')
        .select('input_token, canonical_form')
        .is('org_id', null)
        .eq('registry_type', type)
        .eq('status', 'active')
        .in('input_token', missingTokens);

      if (globalError) {
        console.error('Batch registry lookup error (global entries):', globalError);
      }

      // Add global entries to map (org entries already added, so no override)
      if (globalData) {
        for (const entry of globalData) {
          if (!resultMap.has(entry.input_token)) {
            resultMap.set(entry.input_token, entry.canonical_form);
          }
        }
      }
    }

    console.log(
      `Batch registry lookup complete: ${resultMap.size}/${uniqueTokens.length} tokens found (type: ${type})`
    );

    return resultMap;
  } catch (error) {
    console.error('Batch registry lookup exception:', error);
    return resultMap; // Return partial results if any
  }
}

/**
 * Tokenize a company name into searchable variants
 * Handles: "IBM Corp" → ["ibm corp", "ibm", "international business machines", ...]
 * @param companyName - The company name to tokenize
 * @returns Array of token variants
 */
export function tokenizeCompanyName(companyName: string): string[] {
  const tokens: Set<string> = new Set();
  const normalized = companyName.toLowerCase().trim();

  if (!normalized) return [];

  // Add full normalized name
  tokens.add(normalized);

  // Common company suffixes to remove
  const suffixes = [
    'inc', 'corp', 'corporation', 'incorporated', 'ltd', 'limited',
    'llc', 'llp', 'plc', 'co', 'company', 'group', 'holdings',
    'international', 'technologies', 'technology', 'tech',
    'solutions', 'services', 'systems', 'enterprises', 'industries'
  ];

  // Remove suffixes and add as tokens
  let withoutSuffix = normalized;
  for (const suffix of suffixes) {
    const patterns = [
      new RegExp(`\\s+${suffix}\\s*$`, 'i'),
      new RegExp(`\\s+${suffix}\\.\\s*$`, 'i'),
      new RegExp(`\\s+${suffix},\\s*$`, 'i')
    ];

    for (const pattern of patterns) {
      if (pattern.test(withoutSuffix)) {
        withoutSuffix = withoutSuffix.replace(pattern, '').trim();
        tokens.add(withoutSuffix);
        break;
      }
    }
  }

  // Remove common symbols and add as token
  const withoutSymbols = normalized
    .replace(/[.,\-&()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutSymbols !== normalized) {
    tokens.add(withoutSymbols);
  }

  // Generate acronym from multi-word names
  const words = withoutSuffix.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 1) {
    const acronym = words
      .filter(w => !suffixes.includes(w)) // Exclude suffix words
      .map(w => w[0])
      .join('');

    if (acronym.length >= 2 && acronym.length <= 6) {
      tokens.add(acronym);
    }
  }

  // Add individual significant words (3+ chars)
  for (const word of words) {
    if (word.length >= 3 && !suffixes.includes(word)) {
      tokens.add(word);
    }
  }

  return Array.from(tokens);
}

/**
 * Tokenize a contact name into searchable variants
 * Handles: "John Smith" → ["john", "smith", "john smith"]
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Array of token variants
 */
export function tokenizeContactName(
  firstName?: string,
  lastName?: string
): { firstTokens: string[], lastTokens: string[] } {
  const firstTokens: Set<string> = new Set();
  const lastTokens: Set<string> = new Set();

  if (firstName) {
    const normalized = firstName.toLowerCase().trim();
    firstTokens.add(normalized);

    // Handle compound first names
    const parts = normalized.split(/[\s\-]+/);
    if (parts.length > 1) {
      parts.forEach(part => {
        if (part.length >= 2) {
          firstTokens.add(part);
        }
      });
    }

    // Handle common nickname patterns (remove if in registry later)
    // e.g., "Johnny" might map to "John"
  }

  if (lastName) {
    const normalized = lastName.toLowerCase().trim();
    lastTokens.add(normalized);

    // Handle compound last names with prefixes
    const prefixes = ['van', 'von', 'de', 'di', 'du', 'da', 'del', 'della', 'le', 'la', 'el', 'al', 'ibn'];

    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix + ' ')) {
        const withoutPrefix = normalized.substring(prefix.length + 1).trim();
        lastTokens.add(withoutPrefix);
        lastTokens.add(prefix); // Also add prefix separately
      }
    }

    // Handle hyphenated last names
    const parts = normalized.split('-');
    if (parts.length > 1) {
      parts.forEach(part => {
        if (part.length >= 2) {
          lastTokens.add(part.trim());
        }
      });
    }

    // Handle Mc/Mac prefixes
    if (normalized.startsWith('mc') || normalized.startsWith('mac')) {
      const withoutPrefix = normalized.startsWith('mc')
        ? normalized.substring(2)
        : normalized.substring(3);
      if (withoutPrefix.length >= 2) {
        lastTokens.add(withoutPrefix);
      }
    }

    // Handle O' prefix
    if (normalized.startsWith("o'")) {
      const withoutPrefix = normalized.substring(2);
      if (withoutPrefix.length >= 2) {
        lastTokens.add(withoutPrefix);
      }
    }
  }

  return {
    firstTokens: Array.from(firstTokens),
    lastTokens: Array.from(lastTokens)
  };
}

/**
 * Add an entry to the name registry
 * @param orgId - The organization ID
 * @param type - The registry type
 * @param inputToken - The input token
 * @param canonicalForm - The canonical form
 * @param source - The source of the entry
 * @param context - Additional context (stored as trigger_context if needed)
 */
export async function addToRegistry(
  orgId: string,
  type: RegistryType,
  inputToken: string,
  canonicalForm: string,
  source: 'admin_correction' | 'hubspot_edit' | 'ai_suggestion' | 'manual',
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const normalizedInput = inputToken.toLowerCase().trim();

    if (!normalizedInput || !canonicalForm.trim()) {
      console.error('Invalid input_token or canonical_form for registry');
      return;
    }

    // Insert into name_registry table
    const { error } = await supabaseAdmin
      .from('name_registry')
      .insert({
        org_id: orgId,
        registry_type: type,
        input_token: normalizedInput,
        canonical_form: canonicalForm.trim(),
        source,
        confidence: source === 'ai_suggestion' ? 0.85 : 1.00,
        status: source === 'ai_suggestion' ? 'pending_review' : 'active',
        occurrence_count: 1,
        last_seen_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error adding to registry:', error);
      return;
    }

    console.log(`Added to registry: ${normalizedInput} → ${canonicalForm} (${type})`);
  } catch (error) {
    console.error('Exception adding to registry:', error);
  }
}

/**
 * Queue a normalization for manual review
 * @param orgId - The organization ID
 * @param type - The registry type
 * @param inputToken - The input token
 * @param suggestedCanonical - The suggested canonical form
 * @param triggerType - The trigger type (hubspot_edit, low_confidence, admin_correction)
 * @param context - Additional context (record_id, field, original_value, etc.)
 */
export async function queueForReview(
  orgId: string,
  type: RegistryType,
  inputToken: string,
  suggestedCanonical: string,
  triggerType: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const normalizedInput = inputToken.toLowerCase().trim();

    if (!normalizedInput || !suggestedCanonical.trim()) {
      console.error('Invalid input_token or suggested_canonical for review queue');
      return;
    }

    // Insert into name_registry_queue table
    const { error } = await supabaseAdmin
      .from('name_registry_queue')
      .insert({
        org_id: orgId,
        registry_type: type,
        input_token: normalizedInput,
        suggested_canonical: suggestedCanonical.trim(),
        trigger_type: triggerType,
        trigger_context: context || null,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error queueing for review:', error);
      return;
    }

    console.log(`Queued for review: ${normalizedInput} → ${suggestedCanonical} (${type})`);
  } catch (error) {
    console.error('Exception queueing for review:', error);
  }
}
