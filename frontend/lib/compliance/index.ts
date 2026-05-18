/**
 * Compliance Module
 *
 * Exports all compliance-related functionality.
 */

// Types
export * from './types';

// Score calculation
export {
  getScore,
  getBreakdownByHarmony,
  getBreakdownByField,
  getTrend,
  getDrilldown,
  storeScoreHistory,
  getPreviousScore,
} from './compliance-score';

// Scanner
export {
  runComplianceScan,
  enqueueScan,
  getScanQueue,
  startScanWorker,
  stopScanWorker,
  getScanQueueStats,
  type ScanJobData,
} from './compliance-scanner';

// Insights
export {
  generateInsights,
  getActiveInsights,
  dismissInsight,
  clearInsights,
} from './insight-generator';

// Alerts
export {
  getAlertConfig,
  saveAlertConfig,
  evaluateAlerts,
  registerAlertCallback,
  clearAlertCallbacks,
} from './alert-evaluator';

// Normalized Records Writer (pipeline integration)
export {
  normalizeFieldValue,
  writeNormalizedRecord,
  writeNormalizedRecordsBatch,
  processAndWriteRecordFields,
  getCurrentHarmonyVersions,
  type FieldNormalizationResult,
} from './normalized-records-writer';
