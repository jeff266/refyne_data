/**
 * Queue Module
 *
 * BullMQ-based job queue for async processing.
 */

// Redis connection
export {
  getRedisOptions,
  createRedisConnection,
  getRedisConnection,
  isRedisConfigured,
  closeRedisConnection,
} from './redis';

// Webhook queue
export {
  getWebhookQueue,
  enqueueWebhookEvent,
  enqueueWebhookBatch,
  startWebhookWorker,
  stopWebhookWorker,
  getQueueStats,
  getWorkerConcurrency,
  getRateLimitSettings,
} from './webhook-queue';

export type {
  WebhookJobData,
  WebhookJobResult,
} from './webhook-queue';

// Rollback queue
export {
  getRollbackQueue,
  enqueueRollbackJob,
  startRollbackWorker,
  stopRollbackWorker,
  getRollbackQueueStats,
} from './rollback-queue';

export type {
  RollbackJobData,
  RollbackJobResult,
} from './rollback-queue';
