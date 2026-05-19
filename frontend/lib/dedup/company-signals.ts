/**
 * Company Dedup Signals
 *
 * Evaluates pairs of companies to determine if they're duplicates.
 * Returns confidence score, grade, and list of matching signals.
 */

import { similarity, extractDomain, formatPhone } from '../harmonies/runtime/builtins';
import type { FiredSignal, PairGrade } from './types';

export interface CompanyProperties {
  name: string | null;
  domain: string | null;
  phone: string | null;
  industry: string | null;
  linkedin_company_page: string | null;
}

export interface CompanyPairEvaluation {
  confidence: number;
  grade: PairGrade;
  nameSimilarity: number | null;
  signalsFired: FiredSignal[];
}

/**
 * Normalize domain for comparison (strip www, lowercase).
 */
export function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;
  return extractDomain(domain)?.toLowerCase().replace(/^www\./, '') || null;
}

/**
 * Normalize phone to E.164 format for comparison.
 */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const formatted = formatPhone(phone, 'US');
  return formatted?.replace(/\D/g, '') || null;
}

/**
 * Normalize LinkedIn URL for comparison.
 */
function normalizeLinkedIn(url: string | null): string | null {
  if (!url) return null;
  return url.toLowerCase().trim().replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '');
}

/**
 * Evaluate a pair of companies for duplicate likelihood.
 *
 * Signal hierarchy:
 * 1. Domain exact match (95% confidence, Grade A)
 * 2. LinkedIn URL match (95% confidence, Grade A)
 * 3. Phone E.164 match (+20%)
 * 4. Name fuzzy match >85% (+15-25%)
 * 5. Name + industry match (+10%)
 *
 * Grading:
 * - 95%+: Grade A
 * - 80-94%: Grade B
 * - 65-79%: Grade C
 * - <65%: Grade D (skip/don't store)
 */
export function evaluateCompanyPair(
  companyA: CompanyProperties,
  companyB: CompanyProperties
): CompanyPairEvaluation {
  const signalsFired: FiredSignal[] = [];
  let confidence = 0;
  let nameSimilarity: number | null = null;

  // Signal 1: Domain exact match (deterministic, Grade A automatic)
  const domainA = normalizeDomain(companyA.domain);
  const domainB = normalizeDomain(companyB.domain);

  if (domainA && domainB && domainA === domainB) {
    confidence = 95;
    signalsFired.push({
      tier: 1,
      type: 'domain',
      deterministic: true,
      score: 95,
    });
  }

  // Signal 2: LinkedIn URL match (deterministic, Grade A automatic)
  const linkedInA = normalizeLinkedIn(companyA.linkedin_company_page);
  const linkedInB = normalizeLinkedIn(companyB.linkedin_company_page);

  if (linkedInA && linkedInB && linkedInA === linkedInB) {
    if (confidence < 95) {
      confidence = 95;
    }
    signalsFired.push({
      tier: 1,
      type: 'linkedin',
      deterministic: true,
      score: 95,
    });
  }

  // Signal 3: Phone E.164 match
  const phoneA = normalizePhone(companyA.phone);
  const phoneB = normalizePhone(companyB.phone);

  if (phoneA && phoneB && phoneA === phoneB) {
    confidence += 20;
    signalsFired.push({
      tier: 2,
      type: 'phone',
      deterministic: true,
      score: 20,
    });
  }

  // Signal 4: Name fuzzy match (>85% similarity)
  if (companyA.name && companyB.name) {
    const nameA = companyA.name.toLowerCase().trim();
    const nameB = companyB.name.toLowerCase().trim();

    nameSimilarity = similarity(nameA, nameB);

    if (nameSimilarity >= 0.85) {
      const score = Math.round(15 + (nameSimilarity - 0.85) * 66); // 15-25 points
      confidence += score;
      signalsFired.push({
        tier: 3,
        type: 'name',
        deterministic: false,
        score,
      });
    }
  }

  // Signal 5: Name + Industry match
  if (
    companyA.name &&
    companyB.name &&
    companyA.industry &&
    companyB.industry &&
    nameSimilarity !== null &&
    nameSimilarity >= 0.70
  ) {
    const industryA = companyA.industry.toLowerCase().trim();
    const industryB = companyB.industry.toLowerCase().trim();

    if (industryA === industryB) {
      confidence += 10;
      signalsFired.push({
        tier: 4,
        type: 'name_industry',
        deterministic: false,
        score: 10,
      });
    }
  }

  // Cap confidence at 100
  confidence = Math.min(100, confidence);

  // Assign grade based on confidence
  let grade: PairGrade;
  if (confidence >= 95) grade = 'A';
  else if (confidence >= 80) grade = 'B';
  else if (confidence >= 65) grade = 'C';
  else grade = 'D';

  return {
    confidence,
    grade,
    nameSimilarity,
    signalsFired,
  };
}
