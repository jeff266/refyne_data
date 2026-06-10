import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

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

      if (typeof event.request.data === 'object') {
        for (const key of sensitiveKeys) {
          if (key in event.request.data) {
            event.request.data[key] = '[REDACTED]';
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
