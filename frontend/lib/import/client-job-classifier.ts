/**
 * Client-Side Job Title Classifier
 *
 * Rule-based classification for filtering imports without API calls.
 * Uses regex and keyword matching based on job-title-classifier.ts rules.
 */

export type JobLevel =
  | 'C-Suite'
  | 'EVP / SVP'
  | 'VP'
  | 'Director'
  | 'Manager'
  | 'IC'
  | 'Founder'
  | 'Other'
  | 'Needs Review';

/**
 * Classify a job title into a seniority level using client-side rules.
 * No API calls - purely regex and keyword matching.
 */
export function classifyJobTitleLevel(rawTitle: string | null | undefined): JobLevel {
  if (!rawTitle?.trim()) {
    return 'Other';
  }

  const title = rawTitle.toLowerCase().trim();

  // C-Suite patterns (check first - highest priority)
  const cSuitePatterns = [
    /\b(ceo|chief executive officer)\b/,
    /\b(cfo|chief financial officer)\b/,
    /\b(cto|chief technology officer)\b/,
    /\b(coo|chief operating officer)\b/,
    /\b(cmo|chief marketing officer)\b/,
    /\b(cro|chief revenue officer)\b/,
    /\b(cio|chief information officer)\b/,
    /\b(cpo|chief product officer)\b/,
    /\b(cso|chief (sales|strategy|security) officer)\b/,
    /\bchief clinical officer\b/,
    /\bchief medical officer\b/,
    /\bc-level\b/,
    /\bc-suite\b/,
  ];

  for (const pattern of cSuitePatterns) {
    if (pattern.test(title)) {
      return 'C-Suite';
    }
  }

  // EVP / SVP patterns (before VP check)
  const evpSvpPatterns = [
    /\bexecutive vice president\b/,
    /\bevp\b/,
    /\bsenior vice president\b/,
    /\bsvp\b/,
    /\bexecutive vp\b/,
    /\bsenior vp\b/,
  ];

  for (const pattern of evpSvpPatterns) {
    if (pattern.test(title)) {
      return 'EVP / SVP';
    }
  }

  // VP patterns (must come after EVP/SVP check)
  const vpPatterns = [
    /\bvice president\b/,
    /\bvp\b/,
    /v\.p\./,
  ];

  // Check for "Assistant to the VP" first
  if (/\bassistant to the\b/.test(title)) {
    return 'IC';
  }

  for (const pattern of vpPatterns) {
    if (pattern.test(title)) {
      return 'VP';
    }
  }

  // Founder patterns (after VP/EVP check)
  const founderPatterns = [
    /\bfounder\b/,
    /\bco-founder\b/,
    /\bowner\b/,
    /\bpresident\b(?!.*\bvice\b)/, // President but not Vice President
  ];

  for (const pattern of founderPatterns) {
    if (pattern.test(title)) {
      return 'Founder';
    }
  }

  // Director patterns
  const directorPatterns = [
    /\bdirector\b/,
    /\bhead of\b/,
    /\bclinical director\b/,
    /\bclinical supervisor\b/,
    /\bprogram director\b/,
    /\bdirector of\b/,
  ];

  for (const pattern of directorPatterns) {
    if (pattern.test(title)) {
      return 'Director';
    }
  }

  // Manager patterns
  const managerPatterns = [
    /\bmanager\b/,
    /\bmgr\b/,
    /\bsupervisor\b/,
    /\blead\b/,
    /\bteam lead\b/,
    /\bproject manager\b/,
    /\bprogram manager\b/,
    /\baccount manager\b/,
    /\bsales manager\b/,
  ];

  for (const pattern of managerPatterns) {
    if (pattern.test(title)) {
      return 'Manager';
    }
  }

  // IC patterns - specific roles (check before ambiguous patterns)
  const specificIcPatterns = [
    /\bbcba\b/,
    /\bboard certified behavior analyst\b/,
    /\btherapist\b/,
    /\bpsychologist\b/,
    /\bbehavior technician\b/,
    /\brbt\b/, // Registered Behavior Technician
    /\baccount executive\b/,
    /\bsdr\b/,
    /\bbdr\b/,
  ];

  for (const pattern of specificIcPatterns) {
    if (pattern.test(title)) {
      return 'IC';
    }
  }

  // Ambiguous titles that need human review (after specific IC check)
  const ambiguousPatterns = [
    /\bmember\b/,
    /\bexpert\b/,
    /\badvisor\b(?!.*\b(board certified)\b)/, // Advisor but not part of BCBA
    /\bconsultant\b/,
    /\bspecialist\b(?!.*\b(senior|lead|principal)\b)/, // Specialist without seniority keyword
    /\banalyst\b(?!.*\b(senior|lead|principal|board certified)\b)/, // Analyst without seniority keyword or BCBA
  ];

  for (const pattern of ambiguousPatterns) {
    if (pattern.test(title)) {
      return 'Needs Review';
    }
  }

  // General IC patterns
  const generalIcPatterns = [
    /\bcoordinator\b/,
    /\brepresentative\b/,
    /\bsales rep\b/,
    /\bmarketing coordinator\b/,
    /\boperations coordinator\b/,
    /\bengineer\b(?!.*\b(chief|head|director|manager|lead)\b)/, // Engineer without leadership keywords
    /\bdeveloper\b(?!.*\b(chief|head|director|manager|lead)\b)/, // Developer without leadership keywords
    /\bdesigner\b(?!.*\b(chief|head|director|manager|lead)\b)/, // Designer without leadership keywords
    /\baccountant\b(?!.*\b(chief|head|director|manager|lead)\b)/, // Accountant without leadership keywords
  ];

  for (const pattern of generalIcPatterns) {
    if (pattern.test(title)) {
      return 'IC';
    }
  }

  // If contains "senior", "principal", or "staff" → likely IC
  if (/\b(senior|principal|staff)\b/.test(title) && !/\b(director|manager|vp|president)\b/.test(title)) {
    return 'IC';
  }

  // Default to Other if no patterns match
  return 'Other';
}

/**
 * Count contacts by job level from a list of titles.
 */
export function countByJobLevel(titles: Array<string | null | undefined>): Record<JobLevel, number> {
  const counts: Record<JobLevel, number> = {
    'C-Suite': 0,
    'EVP / SVP': 0,
    VP: 0,
    Director: 0,
    Manager: 0,
    IC: 0,
    Founder: 0,
    Other: 0,
    'Needs Review': 0,
  };

  for (const title of titles) {
    const level = classifyJobTitleLevel(title);
    counts[level]++;
  }

  return counts;
}
