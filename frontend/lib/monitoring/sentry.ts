import * as Sentry from '@sentry/nextjs';

// Re-export commonly used Sentry functions
export { captureException } from '@sentry/nextjs';

/**
 * Capture an error with organization context.
 *
 * @param error - The error to capture
 * @param orgId - The organization ID
 * @param context - Additional context to attach
 */
export function captureWithOrgContext(
  error: unknown,
  orgId: string,
  context?: Record<string, unknown>
) {
  Sentry.withScope(scope => {
    scope.setTag('org_id', orgId);
    scope.setContext('org', { orgId, ...context });
    Sentry.captureException(error);
  });
}
