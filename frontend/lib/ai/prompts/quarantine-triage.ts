/**
 * Quarantine Triage AI Prompt
 *
 * Generates plain-English explanation and recommendation
 * for duplicate detection decisions.
 */

export const QUARANTINE_TRIAGE_SYSTEM = `
You are a CRM data quality analyst reviewing a potential duplicate record.
Explain in plain English why these two records were flagged.

Rules:
- Explanation: 2-3 sentences. Reference specific matching signals.
- Be direct about evidence strength.
- If confidence >85%: lean toward recommending reject
- If confidence 60-85%: acknowledge ambiguity
- Recommendation: approve, reject, or needs_review
- Never say "it appears" or "it seems"
- Tone: analytical, confident, brief

Respond ONLY with valid JSON:
{
  "explanation": "2-3 sentences",
  "recommendation": "approve | reject | needs_review",
  "keySignal": "the single strongest matching signal",
  "confidence_plain": "one phrase e.g. 'very likely duplicate'"
}
`;

export interface QuarantineInput {
  submitted: {
    name: string;
    domain?: string;
    industry?: string;
    employeeCount?: number;
    linkedinUrl?: string;
  };
  existing: {
    name: string;
    domain?: string;
    industry?: string;
    employeeCount?: number;
    linkedinUrl?: string;
    createdDaysAgo: number;
  };
  submitterName: string;
  submitterRole: string;
  signals: string[];
  confidence: number;
  grade: string;
}

export function buildQuarantinePrompt(data: QuarantineInput): string {
  return `
Submitted record:
  Company: ${data.submitted.name}
  Domain: ${data.submitted.domain ?? 'not provided'}
  Industry: ${data.submitted.industry ?? 'not provided'}
  Employees: ${data.submitted.employeeCount ?? 'not provided'}
  LinkedIn: ${data.submitted.linkedinUrl ?? 'not provided'}
  Submitted by: ${data.submitterName} (${data.submitterRole})

Existing HubSpot record:
  Company: ${data.existing.name}
  Domain: ${data.existing.domain ?? 'not provided'}
  Industry: ${data.existing.industry ?? 'not provided'}
  Employees: ${data.existing.employeeCount ?? 'not provided'}
  LinkedIn: ${data.existing.linkedinUrl ?? 'not provided'}
  Record age: ${data.existing.createdDaysAgo} days old

Signals matched: ${data.signals.join(', ')}
Confidence: ${data.confidence}%
Grade: ${data.grade}
`;
}

export interface QuarantineOutput {
  explanation: string;
  recommendation: 'approve' | 'reject' | 'needs_review';
  keySignal: string;
  confidence_plain: string;
}
