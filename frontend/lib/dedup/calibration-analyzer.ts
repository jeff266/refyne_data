/**
 * Dedup Calibration Analyzer
 *
 * Analyzes user decisions on sample duplicate pairs during onboarding
 * to suggest survivorship rules based on observed patterns.
 */

export interface DedupSamplePair {
  pair_id: string;
  confidence: number;
  grade: 'A' | 'B';
  signals_fired: string[];
  company_a: CompanySnapshot;
  company_b: CompanySnapshot;
}

export interface CompanySnapshot {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  employee_count: string | null;
  owner_name: string | null;
  createdate: string | null;
}

export interface CalibrationDecision {
  pair_id: string;
  verdict: 'duplicate' | 'not_duplicate' | 'unsure';
  survivor_preference?: 'a' | 'b' | 'auto';
  company_a_id: string;
  company_b_id: string;
}

export interface SuggestedRule {
  field: string;
  strategy: 'prefer_nonempty' | 'prefer_longest' | 'prefer_newest' | 'tld_preference';
  confidence: number;
  explanation: string;
  sample_count: number;
}

const CONFIDENCE_THRESHOLD = 0.7;
const MIN_DECISIONS = 3;

/**
 * Analyze user feedback to suggest survivorship rules
 */
export function analyzeFeedback(
  decisions: CalibrationDecision[],
  samples: DedupSamplePair[]
): SuggestedRule[] {
  const rules: SuggestedRule[] = [];

  const mergeDecisions = decisions.filter(d =>
    d.verdict === 'duplicate' &&
    d.survivor_preference &&
    d.survivor_preference !== 'auto'
  );

  if (mergeDecisions.length < MIN_DECISIONS) {
    return [];
  }

  // Heuristic 1: Name length preference
  const nameLengthRule = analyzeNameLengthPreference(mergeDecisions, samples);
  if (nameLengthRule) rules.push(nameLengthRule);

  // Heuristic 2: Domain TLD preference
  const tldRule = analyzeTldPreference(mergeDecisions, samples);
  if (tldRule) rules.push(tldRule);

  // Heuristic 3: Recency preference
  const recencyRule = analyzeRecencyPreference(mergeDecisions, samples);
  if (recencyRule) rules.push(recencyRule);

  // Heuristic 4: Completeness preference
  const completenessRule = analyzeCompletenessPreference(mergeDecisions, samples);
  if (completenessRule) rules.push(completenessRule);

  return rules;
}

function analyzeNameLengthPreference(
  decisions: CalibrationDecision[],
  samples: DedupSamplePair[]
): SuggestedRule | null {
  const preferences = decisions.map(d => {
    const sample = samples.find(s => s.pair_id === d.pair_id);
    if (!sample) return null;

    const preferredA = d.survivor_preference === 'a';
    const lengthA = sample.company_a.name?.length || 0;
    const lengthB = sample.company_b.name?.length || 0;

    if (lengthA === lengthB) return null;

    return preferredA === (lengthA > lengthB);
  }).filter(p => p !== null);

  if (preferences.length < MIN_DECISIONS) return null;

  const consistency = preferences.filter(p => p === true).length / preferences.length;

  if (consistency >= CONFIDENCE_THRESHOLD) {
    return {
      field: 'name',
      strategy: 'prefer_longest',
      confidence: Math.round(consistency * 100),
      explanation: 'You consistently chose records with more complete company names',
      sample_count: preferences.length,
    };
  }

  return null;
}

function analyzeTldPreference(
  decisions: CalibrationDecision[],
  samples: DedupSamplePair[]
): SuggestedRule | null {
  const preferences = decisions.map(d => {
    const sample = samples.find(s => s.pair_id === d.pair_id);
    if (!sample) return null;

    const preferredA = d.survivor_preference === 'a';
    const domainA = sample.company_a.domain;
    const domainB = sample.company_b.domain;

    if (!domainA || !domainB) return null;

    const tldA = domainA.split('.').pop();
    const tldB = domainB.split('.').pop();

    if (tldA === tldB) return null;

    const aIsCom = tldA === 'com';
    const bIsCom = tldB === 'com';

    if (aIsCom === bIsCom) return null;

    return preferredA === aIsCom;
  }).filter(p => p !== null);

  if (preferences.length < MIN_DECISIONS) return null;

  const consistency = preferences.filter(p => p === true).length / preferences.length;

  if (consistency >= CONFIDENCE_THRESHOLD) {
    return {
      field: 'domain',
      strategy: 'tld_preference',
      confidence: Math.round(consistency * 100),
      explanation: 'You consistently preferred .com domains over other TLDs',
      sample_count: preferences.length,
    };
  }

  return null;
}

function analyzeRecencyPreference(
  decisions: CalibrationDecision[],
  samples: DedupSamplePair[]
): SuggestedRule | null {
  const preferences = decisions.map(d => {
    const sample = samples.find(s => s.pair_id === d.pair_id);
    if (!sample) return null;

    const preferredA = d.survivor_preference === 'a';
    const dateA = sample.company_a.createdate ? new Date(sample.company_a.createdate) : null;
    const dateB = sample.company_b.createdate ? new Date(sample.company_b.createdate) : null;

    if (!dateA || !dateB) return null;
    if (dateA.getTime() === dateB.getTime()) return null;

    return preferredA === (dateA > dateB);
  }).filter(p => p !== null);

  if (preferences.length < MIN_DECISIONS) return null;

  const consistency = preferences.filter(p => p === true).length / preferences.length;

  if (consistency >= CONFIDENCE_THRESHOLD) {
    return {
      field: 'createdate',
      strategy: 'prefer_newest',
      confidence: Math.round(consistency * 100),
      explanation: 'You consistently chose more recently created records',
      sample_count: preferences.length,
    };
  }

  return null;
}

function analyzeCompletenessPreference(
  decisions: CalibrationDecision[],
  samples: DedupSamplePair[]
): SuggestedRule | null {
  const preferences = decisions.map(d => {
    const sample = samples.find(s => s.pair_id === d.pair_id);
    if (!sample) return null;

    const preferredA = d.survivor_preference === 'a';

    const fieldsA = Object.values(sample.company_a).filter(v => v !== null && v !== '').length;
    const fieldsB = Object.values(sample.company_b).filter(v => v !== null && v !== '').length;

    if (fieldsA === fieldsB) return null;

    return preferredA === (fieldsA > fieldsB);
  }).filter(p => p !== null);

  if (preferences.length < MIN_DECISIONS) return null;

  const consistency = preferences.filter(p => p === true).length / preferences.length;

  if (consistency >= CONFIDENCE_THRESHOLD) {
    return {
      field: '*',
      strategy: 'prefer_nonempty',
      confidence: Math.round(consistency * 100),
      explanation: 'You consistently preferred records with more complete data',
      sample_count: preferences.length,
    };
  }

  return null;
}
