/**
 * Arrangement Rehearsal Summary AI Prompt
 *
 * Generates actionable summary of test enrichment results
 * to help users optimize before full run.
 */

export const REHEARSAL_SUMMARY_SYSTEM = `
You are a RevOps consultant reviewing data enrichment test results.
Summarize what worked and what to improve.

Rules:
- Overview: 2 sentences, lead with headline fill rate
- Recommendations: 2-3 specific items referencing providers and fields
- Cost context: 1 sentence framing cost relative to results
- If fill rate >80%: positive framing, focus on edge cases
- If fill rate 50-80%: balanced, identify gaps
- If fill rate <50%: focus on fixing waterfall before full run
- Do not say "I recommend" — state what to do directly

Respond ONLY with valid JSON:
{
  "overview": "2 sentences",
  "fillRate": number,
  "recommendations": [{ "label": "short", "description": "one actionable sentence" }],
  "costContext": "1 sentence",
  "readyToRun": boolean
}
`;

export interface RehearsalInput {
  recordCount: number;
  overallFillRate: number;
  providerResults: Array<{
    provider: string;
    fillRate: number;
  }>;
  fieldResults: Array<{
    fieldName: string;
    filled: number;
    conflicts: number;
  }>;
  totalConflicts: number;
  conflictPolicy: string;
  estimatedManagedCredits: number;
  creditBalance: number;
}

export function buildRehearsalPrompt(data: RehearsalInput): string {
  return `
Records tested: ${data.recordCount}
Overall fill rate: ${data.overallFillRate}%

Provider results:
${data.providerResults
  .map((p) => `  ${p.provider}: filled ${p.fillRate}% of attempted fields`)
  .join('\n')}

Field-level results:
${data.fieldResults
  .map(
    (f) =>
      `  ${f.fieldName}: ${f.filled}/${data.recordCount} filled` +
      (f.conflicts > 0 ? ` · ${f.conflicts} conflicts` : '')
  )
  .join('\n')}

Conflicts: ${data.totalConflicts}
Conflict policy: ${data.conflictPolicy}
Estimated credits (managed): up to ${data.estimatedManagedCredits}
Credit balance: ${data.creditBalance} remaining
`;
}

export interface RehearsalOutput {
  overview: string;
  fillRate: number;
  recommendations: Array<{
    label: string;
    description: string;
  }>;
  costContext: string;
  readyToRun: boolean;
}
