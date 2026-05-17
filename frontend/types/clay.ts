// Clay Async Cascade Integration Types

export interface ClayCalibrationResult {
  recordId: string;
  sentAt: Date;
  receivedAt?: Date;
  durationMs?: number;
  success: boolean;
  error?: string;
}

export interface ClayCalibrationSummary {
  calibratedAt: Date;
  sampleCount: number;
  successCount: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  recommendedTimeoutMs: number;
}

export type TimeoutMode = 'recommended' | 'custom' | 'ask_each_run';
export type OnTimeoutAction = 'skip' | 'retry_once' | 'fail';

export interface ClayStepConfig {
  // Webhook configuration
  webhookUrl: string;           // User's Clay table webhook URL
  callbackUrl: string;          // Auto-generated callback URL
  webhookSecret?: string;       // Optional signature verification

  // Calibration data
  calibration?: ClayCalibrationSummary;

  // Timeout settings
  timeoutMode: TimeoutMode;
  customTimeoutMs?: number;
  bufferPercent: number;        // Default 30%

  // Fallback behavior
  onTimeout: OnTimeoutAction;
  maxRetries: number;

  // Runtime state tracking
  expandedTimeoutMs?: number;   // If auto-expanded due to failures
}

export interface ClayPendingRequest {
  requestId: string;
  segmentId: string;
  cascadeStepIndex: number;
  records: Record<string, any>[];
  sentAt: Date;
  timeoutMs: number;
  status: 'pending' | 'received' | 'timeout' | 'error';
  receivedAt?: Date;
  enrichedRecords?: Record<string, any>[];
  error?: string;
}

export interface ClayWebhookPayload {
  request_id: string;
  records: Record<string, any>[];
  metadata?: {
    processing_time_ms?: number;
    table_id?: string;
  };
}

// Default configuration
export const DEFAULT_CLAY_CONFIG: Partial<ClayStepConfig> = {
  timeoutMode: 'recommended',
  bufferPercent: 30,
  onTimeout: 'skip',
  maxRetries: 1,
};

// Calculate recommended timeout from calibration
export function calculateRecommendedTimeout(
  calibration: ClayCalibrationSummary
): number {
  // Use p95 + buffer, minimum 10 seconds
  const base = calibration.p95Ms || calibration.maxMs;
  const withBuffer = base * (1 + calibration.sampleCount > 3 ? 0.3 : 0.5);
  return Math.max(10000, Math.ceil(withBuffer / 1000) * 1000); // Round to nearest second
}
