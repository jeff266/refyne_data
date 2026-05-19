/**
 * Contact Dedup Signals
 *
 * Evaluates potential duplicate contacts using a 5-signal cascade.
 * Email match alone produces automatic Grade A (95 confidence).
 * Other signals combine for probabilistic scoring.
 */

import { similarity } from '../harmonies/runtime/builtins';
import type { FiredSignal, PairGrade } from './types';

/**
 * Contact properties needed for dedup evaluation.
 */
export interface ContactProperties {
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  phone?: string | null;
  jobtitle?: string | null;
  company?: string | null;
  hs_linkedinid?: string | null;
}

/**
 * Contact dedup evaluation result.
 */
export interface ContactPairEvaluation {
  confidence: number;
  grade: PairGrade;
  nameSimilarity: number | null;
  signalsFired: FiredSignal[];
}

/**
 * Normalize email for comparison.
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

/**
 * Normalize LinkedIn URL for comparison.
 * Strips trailing slashes, lowercases.
 */
function normalizeLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null;
  let normalized = url.toLowerCase().trim();
  // Remove trailing slashes
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Convert phone to E.164-like format (digits only with + prefix).
 * Simplified version - just extracts digits.
 */
function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null; // Too short to be valid
  return `+${digits}`;
}

/**
 * Normalize name for fuzzy matching.
 * Lowercase, collapse whitespace.
 */
function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Calculate fuzzy name match score.
 * Uses Levenshtein-based similarity.
 */
function fuzzyNameMatch(
  firstA: string | null | undefined,
  lastA: string | null | undefined,
  firstB: string | null | undefined,
  lastB: string | null | undefined
): number {
  const fullA = [firstA, lastA].filter(Boolean).join(' ');
  const fullB = [firstB, lastB].filter(Boolean).join(' ');

  if (!fullA || !fullB) return 0;

  const normA = normalizeName(fullA);
  const normB = normalizeName(fullB);

  if (!normA || !normB) return 0;

  return similarity(normA, normB);
}

/**
 * Evaluate a contact pair for potential duplication.
 *
 * Signal cascade (priority order):
 * 1. Email exact match → automatic Grade A (95 confidence)
 * 2. LinkedIn URL exact match
 * 3. Name + Company fuzzy match (both firstname/lastname + company)
 * 4. Phone E.164 exact match
 * 5. Name-only fuzzy match (firstname + lastname)
 *
 * @param contactA - First contact properties
 * @param contactB - Second contact properties
 * @returns ContactPairEvaluation with confidence, grade, and signals
 */
export function evaluateContactPair(
  contactA: ContactProperties,
  contactB: ContactProperties
): ContactPairEvaluation {
  const signalsFired: FiredSignal[] = [];
  let totalScore = 0;
  let deterministicCount = 0;

  // Signal 1: Email exact match (automatic Grade A)
  const emailA = normalizeEmail(contactA.email);
  const emailB = normalizeEmail(contactB.email);

  if (emailA && emailB && emailA === emailB) {
    signalsFired.push({
      tier: 1,
      type: 'email',
      deterministic: true,
      score: 1.0,
    });
    // Email match alone = automatic Grade A at 95 confidence
    return {
      confidence: 95,
      grade: 'A',
      nameSimilarity: fuzzyNameMatch(
        contactA.firstname,
        contactA.lastname,
        contactB.firstname,
        contactB.lastname
      ),
      signalsFired,
    };
  }

  // Signal 2: LinkedIn URL exact match
  const linkedInA = normalizeLinkedIn(contactA.hs_linkedinid);
  const linkedInB = normalizeLinkedIn(contactB.hs_linkedinid);

  if (linkedInA && linkedInB && linkedInA === linkedInB) {
    signalsFired.push({
      tier: 2,
      type: 'linkedin',
      deterministic: true,
      score: 1.0,
    });
    deterministicCount++;
    totalScore += 0.9; // Very high confidence
  }

  // Signal 3: Name + Company fuzzy match
  const nameSim = fuzzyNameMatch(
    contactA.firstname,
    contactA.lastname,
    contactB.firstname,
    contactB.lastname
  );

  const companyA = normalizeName(contactA.company);
  const companyB = normalizeName(contactB.company);
  const companySim = companyA && companyB ? similarity(companyA, companyB) : 0;

  // Both name and company must meet threshold (0.85)
  if (nameSim >= 0.85 && companySim >= 0.85) {
    signalsFired.push({
      tier: 3,
      type: 'nameCompany',
      deterministic: true, // Treat as deterministic when both thresholds met
      score: (nameSim + companySim) / 2,
    });
    deterministicCount++;
    totalScore += 0.85;
  } else if (nameSim >= 0.70 && companySim >= 0.70) {
    // Lower confidence variant
    signalsFired.push({
      tier: 3,
      type: 'nameCompany',
      deterministic: false,
      score: (nameSim + companySim) / 2,
    });
    totalScore += (nameSim + companySim) / 2 * 0.7;
  }

  // Signal 4: Phone E.164 exact match
  const phoneA = toE164(contactA.phone);
  const phoneB = toE164(contactB.phone);

  if (phoneA && phoneB && phoneA === phoneB) {
    signalsFired.push({
      tier: 4,
      type: 'phone',
      deterministic: true,
      score: 1.0,
    });
    deterministicCount++;
    totalScore += 0.8;
  }

  // Signal 5: Name-only fuzzy match (fallback)
  // Only use if no other deterministic signals fired
  if (deterministicCount === 0 && nameSim >= 0.85) {
    signalsFired.push({
      tier: 5,
      type: 'nameOnly',
      deterministic: false,
      score: nameSim,
    });
    totalScore += nameSim * 0.5; // Lower weight for name-only
  }

  // Calculate final confidence
  const confidence = Math.min(100, totalScore * 100);

  // Determine grade based on spec:
  // A: deterministic >= 2 AND name_similarity >= 0.70
  // B: deterministic >= 1 AND name_similarity >= 0.70
  // C: deterministic >= 1 AND name_similarity < 0.40
  // D: deterministic = 0
  let grade: PairGrade;

  if (deterministicCount >= 2 && nameSim >= 0.70) {
    grade = 'A';
  } else if (deterministicCount >= 1 && nameSim >= 0.70) {
    grade = 'B';
  } else if (deterministicCount >= 1 && nameSim < 0.40) {
    grade = 'C';
  } else {
    grade = 'D';
  }

  return {
    confidence,
    grade,
    nameSimilarity: nameSim,
    signalsFired,
  };
}
