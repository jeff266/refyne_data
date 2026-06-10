import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Don't send PII with user context
  sendDefaultPii: false,

  // Scrub sensitive data before sending to Sentry
  beforeSend(event) {
    // Remove sensitive data from request bodies
    if (event.request?.data) {
      const sensitiveKeys = [
        'access_token', 'refresh_token', 'api_key',
        'api_key_enc', 'password', 'secret',
        'token', 'key', 'authorization'
      ];

      if (typeof event.request.data === 'object' && event.request.data !== null) {
        const data = event.request.data as Record<string, any>;
        for (const key of sensitiveKeys) {
          if (key in data) {
            data[key] = '[REDACTED]';
          }
        }
      }
    }

    // Remove authorization headers
    if (event.request?.headers) {
      if (event.request.headers['authorization']) {
        event.request.headers['authorization'] = '[REDACTED]';
      }
      if (event.request.headers['cookie']) {
        event.request.headers['cookie'] = '[REDACTED]';
      }
    }

    // Scrub extra context for sensitive keys
    if (event.extra) {
      const sensitiveKeys = ['token', 'key', 'secret', 'password'];
      for (const key of Object.keys(event.extra)) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          event.extra[key] = '[REDACTED]';
        }
      }
    }

    return event;
  },
});
