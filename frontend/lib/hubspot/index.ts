/**
 * HubSpot Integration Module
 *
 * Exports for HubSpot CRM integration.
 */

// Types
export type {
  HubSpotConnection,
  HubSpotConnectionRow,
  HubSpotList,
  HubSpotCompany,
  HubSpotProperty,
  TokenValidationResult,
  FieldMapping,
  FieldMappingRow,
  FieldMappingDirection,
  WritePolicy,
  EnumValueOption,
  CanonicalToHubSpotMap,
  HubSpotApiError,
  HubSpotPaginatedResponse,
} from './types';

export {
  REQUIRED_SCOPES,
  DEFAULT_COMPANY_PROPERTIES,
  DEFAULT_FIELD_MAPPINGS,
} from './types';

// Client
export {
  HubSpotClient,
  validateToken,
  createHubSpotClient,
} from './client';

export type { CompanyIndex, SchemaProperty, SchemaDiscoveryResult } from './client';

// Repository
export {
  getConnection,
  getConnectionByPortalId,
  saveConnection,
  deleteConnection,
  getFieldMappings,
  seedDefaultFieldMappings,
  updateFieldMapping,
  upsertSchemaFieldMappings,
  getFieldMappingByCanonicalField,
} from './repository';

// Field Mapper
export {
  hubspotToRawRecord,
  hubspotToRawRecords,
  getPropertiesToFetch,
  getMappingSummary,
  type MappingSummary,
} from './field-mapper';

// H2: Write Path Types
export type {
  DedupAction,
  DedupGateResult,
  FieldWriteDecision,
  RecordWriteResult,
  BatchWriteResult,
  BatchWriteInput,
  ReviewQueueItem,
} from './write-types';

// H2: Inverse Mapper
export {
  buildWriteMappings,
  canonicalToHubSpotProperties,
  getDefaultWriteMappings,
} from './inverse-mapper';

// H2: Dedup Gate
export {
  checkDedupGate,
  checkParentRelationship,
  addToReviewQueue,
  addSuppression,
  isSuppressionActive,
  getSuppressions,
  getPendingReviewItems,
  getReviewQueueSize,
} from './dedup-gate';

export type { ParentCheckResult, DedupSuppression } from './dedup-gate';

// H2: Batch Writer
export { executeBatchWrite } from './batch-writer';

export type { BatchWriteResultWithIndex } from './batch-writer';

// H4: Webhook Types
export type {
  HubSpotWebhookEvent,
  WebhookEventStatus,
  WebhookEventRecord,
  WebhookProcessResult,
  NormalizationMode,
} from './write-types';

// H4: Webhook Handler
export {
  validateSignatureV1,
  validateSignatureV3,
  recordEvent,
  updateEventStatus,
  processWebhookEvent,
  processWithRetry,
  processBatchEvents,
  calculateBackoff,
} from './webhook-handler';

export type { RetryConfig } from './webhook-handler';

// Rate Limiter
export {
  parseRateLimitHeaders,
  calculateRetryDelay,
  calculateRetryAfterDelay,
  SlidingWindowRateLimiter,
  acquireGeneralSlot,
  acquireSearchSlot,
  updateFromHeaders,
  getPortalBurstLimit,
  setPortalBurstLimit,
  getRateLimitStatus,
  setDailyLimitAlertCallback,
  isPortalPaused,
  resumePortal,
  clearRateLimiterState,
  DEFAULT_BURST_LIMIT,
  SEARCH_API_LIMIT,
  SEARCH_API_WINDOW_MS,
  DAILY_LIMIT_WARNING_THRESHOLD,
  DAILY_LIMIT_CRITICAL_THRESHOLD,
} from './rate-limiter';

export type {
  RateLimitHeaders,
  RateLimitStatus,
  DailyLimitAlertLevel,
  DailyLimitAlertCallback,
} from './rate-limiter';

export type { BurstLimitObservedCallback } from './client';
