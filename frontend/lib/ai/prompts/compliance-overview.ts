/**
 * Compliance Overview AI Prompt
 *
 * Generates executive summary and actionable recommendations
 * for compliance score dashboard.
 */

export const COMPLIANCE_OVERVIEW_SYSTEM = `
You are a RevOps data quality analyst reviewing CRM health for a B2B SaaS company.
Given structured compliance data, write a specific, actionable overview.

Rules:
- Overview: exactly 2 sentences. Reference specific numbers.
- Actions: exactly 2-3 items. Each must have a concrete next step.
- Never use: "it's important to", "you should consider", "we recommend"
- Do not mention the product name
- Tone: direct, analytical, like a trusted advisor
- Ground everything in the numbers provided. Do not invent data.
- If score improved: acknowledge briefly, focus on remaining gaps
- If score dropped: lead with the primary driver

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "overview": "string — 2 sentences",
  "trend": "improving|declining|stable",
  "actions": [
    {
      "label": "short action label",
      "description": "one sentence describing what to do and expected impact",
      "route": "/normalize | /dedup | /dashboard | /harmonies",
      "urgency": "high | medium | low",
      "estimatedImpact": "e.g. +6 points"
    }
  ]
}
`;

export interface ComplianceInput {
  orgName: string;
  currentScore: number;
  previousScore: number;
  scoreDelta: number;
  harmonyBreakdown: Array<{
    name: string;
    score: number;
    failingRecords: number;
  }>;
  dedupPairs: {
    gradeA: number;
    gradeB: number;
  };
  quarantineCount: number;
  lastNormalizeRun: string | null;
  totalRecords: number;
  recordsWithGaps: number;
  weeklyScores: number[];
}

export function buildCompliancePrompt(data: ComplianceInput): string {
  return `
Org: ${data.orgName}
Current score: ${data.currentScore}/100
Previous score: ${data.previousScore}/100 (${data.scoreDelta > 0 ? '+' : ''}${data.scoreDelta} this week)

Score breakdown by harmony:
${data.harmonyBreakdown
  .map((h) => `  ${h.name}: ${h.score}/100 (${h.failingRecords} records failing)`)
  .join('\n')}

Pending dedup pairs:
  Grade A (>90% confidence): ${data.dedupPairs.gradeA}
  Grade B (75-90%): ${data.dedupPairs.gradeB}

Records in quarantine pending review: ${data.quarantineCount}
Last normalize run: ${data.lastNormalizeRun ?? 'never'}
Total records in CRM: ${data.totalRecords}
Records with data gaps: ${data.recordsWithGaps}
Trend (last 4 weeks): ${data.weeklyScores.join(', ')}
`;
}

export interface ComplianceOutput {
  overview: string;
  trend: 'improving' | 'declining' | 'stable';
  actions: Array<{
    label: string;
    description: string;
    route: string;
    urgency: 'high' | 'medium' | 'low';
    estimatedImpact: string;
  }>;
}
