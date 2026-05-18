// Always On TypeScript types

export interface WorkspaceEntitlement {
  orgId: string;
  alwaysOnEnabled: boolean;
  alwaysOnSince: string | null;
  updatedAt: string;
}

export interface AlwaysOnConfig {
  orgId: string;
  scanTimeUtc: string; // HH:MM:SS format
  digestEnabled: boolean;
  emailRecipients: string[];
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
  sendOnNoChange: boolean;
  scoreDeltaThreshold: number;
  autoMergeGradeA: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DigestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type DigestRunTriggeredBy = 'schedule' | 'manual';

export interface DigestRun {
  id: string;
  orgId: string;
  connectionId: string | null;
  portalName: string | null;
  runAt: string;
  triggeredBy: DigestRunTriggeredBy;
  status: DigestRunStatus;
  scoreBefore: number | null;
  scoreAfter: number | null;
  scoreDelta: number | null;
  newPairsDetected: number;
  newInsights: number;
  recordsScanned: number;
  digestSent: boolean;
  slackSent: boolean;
  skippedReason: string | null;
  errorMessage: string | null;
  digestPayload: DigestPayload | null;
  createdAt: string;
}

export interface RemediationItem {
  rank: number;
  harmony: string;
  harmonyId: string;
  issue: string;
  recordsAffected: number;
  actionLabel: string;
  actionUrl: string;
}

export interface HarmonyBreakdownItem {
  name: string;
  harmonyId: string;
  score: number;
  delta: number;
}

export interface DedupSummary {
  newPairs: number;
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
}

export interface DigestPayload {
  portalName: string;
  digestDate: string;
  score: number;
  scoreDelta: number;
  remediationItems: RemediationItem[];
  harmonyBreakdown: HarmonyBreakdownItem[];
  dedupSummary: DedupSummary;
  newInsightsCount: number;
  dashboardUrl: string;
  dedupUrl: string;
  settingsUrl: string;
  unsubscribeUrl?: string;
}

export interface AlwaysOnStatus {
  enabled: boolean;
  config: AlwaysOnConfig | null;
  lastRun: DigestRun | null;
  nextRunAt: string | null;
}

// API request/response types
export interface AlwaysOnToggleRequest {
  enabled: boolean;
}

export interface AlwaysOnToggleResponse {
  enabled: boolean;
  alwaysOnSince: string | null;
}

export interface AlwaysOnTriggerRequest {
  connectionId?: string;
}

export interface AlwaysOnTriggerResponse {
  jobId: string;
  runId: string;
}

export interface AlwaysOnTestEmailRequest {
  // Empty - uses requesting user's email
}

export interface AlwaysOnTestEmailResponse {
  sent: boolean;
  recipient: string;
}

export interface AlwaysOnTestSlackResponse {
  sent: boolean;
}

export interface AlwaysOnRunsQuery {
  page?: number;
  perPage?: number;
}

export interface AlwaysOnRunsResponse {
  runs: DigestRun[];
  total: number;
  page: number;
  perPage: number;
}
