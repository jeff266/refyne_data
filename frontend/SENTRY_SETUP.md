# Sentry Setup Guide

## Overview

Sentry has been installed and configured for error tracking across the Next.js application.

## Installation Completed

✅ Packages installed:
- @sentry/nextjs (v9.x)
- @sentry/node (v9.x)

✅ Configuration files created:
- `sentry.client.config.ts` - Client-side error tracking
- `sentry.server.config.ts` - Server-side error tracking
- `sentry.edge.config.ts` - Edge runtime error tracking
- `next.config.js` - Wrapped with withSentryConfig

✅ Custom monitoring helper:
- `lib/monitoring/sentry.ts` - captureWithOrgContext function

✅ API routes instrumented:
- 51 API route files updated
- 101 catch blocks now report to Sentry
- All errors include org_id tag and route context

✅ Worker integration:
- `scripts/start-digest-worker.ts` - Sentry initialized
- `lib/jobs/always-on-digest.ts` - Check-in monitoring added

✅ Tests passing:
- All 821 tests still pass

## Environment Variables Required

Add these to your `.env.local` and production environment:

```bash
# Sentry DSN (required for error tracking)
SENTRY_DSN=https://YOUR_KEY@o123456.ingest.sentry.io/123456
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_KEY@o123456.ingest.sentry.io/123456

# Sentry organization and project (optional, for source map uploads)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug

# Sentry auth token (optional, for source map uploads during build)
SENTRY_AUTH_TOKEN=your-auth-token
```

## How to Get Your Sentry DSN

1. Go to https://sentry.io and create an account (or log in)
2. Create a new project:
   - Choose platform: Next.js
   - Name it: enrichment-switcher-frontend
3. Copy the DSN from the project settings
4. Add it to your environment variables

## Features Implemented

### 1. Automatic Error Tracking

All API route errors are now automatically captured with:
- Organization ID as a tag (for filtering)
- Route context (which endpoint failed)
- Full error stack trace
- User context (from Clerk auth)

Example error in Sentry will show:
```
Error: Failed to enqueue compliance scan
  org_id: org_abc123
  route: /api/compliance/scan
  user_id: user_xyz789
```

### 2. Check-in Monitoring

The Always On digest job includes Sentry check-in monitoring:
- Monitor slug: `always-on-digest`
- Tracks: in_progress → ok/error
- Alerts if job doesn't run on schedule

### 3. Custom Context Capture

Use `captureWithOrgContext` for manual error reporting:

```typescript
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

try {
  // Your code
} catch (error) {
  captureWithOrgContext(error, orgId, { 
    route: '/api/custom',
    customField: 'value'
  });
  console.error('Error message:', error);
}
```

## Routes Excluded

The following routes were intentionally NOT instrumented:

- `/api/config` - Demo route with no auth
- Public webhooks (Stripe, Clerk, Clay, HubSpot) - No org context
- Billing routes - Use different error handling pattern
- Public pages (/, /pricing, /privacy, /terms, /docs) - Frontend only

## Monitoring Setup in Sentry

Once you add the DSN and deploy:

1. **Create Alerts**:
   - Go to Sentry → Alerts → Create Alert Rule
   - Set up alerts for:
     - New issues in production
     - High error rate (> 50 errors/hour)
     - Specific errors by org_id

2. **Configure Check-in Monitor**:
   - Go to Crons → Create Monitor
   - Monitor slug: `always-on-digest`
   - Schedule: Daily (matches your digest schedule)
   - Timezone: UTC

3. **Set up Releases** (optional):
   - Enables tracking which version introduced errors
   - Configured via SENTRY_AUTH_TOKEN during build

## Testing Sentry

To verify Sentry is working:

```bash
# 1. Add SENTRY_DSN to .env.local
echo "SENTRY_DSN=https://YOUR_KEY@o123456.ingest.sentry.io/123456" >> .env.local
echo "NEXT_PUBLIC_SENTRY_DSN=https://YOUR_KEY@o123456.ingest.sentry.io/123456" >> .env.local

# 2. Restart dev server
npm run dev

# 3. Trigger an error (e.g., call API with invalid token)
curl http://localhost:3000/api/compliance/scan -X POST -H "Content-Type: application/json" -d '{}'

# 4. Check Sentry dashboard for the error
```

## Production Deployment

For Railway/Vercel:

1. Add environment variables in the dashboard
2. Deploy
3. Verify errors appear in Sentry
4. Set up alerts and monitors

## Cost Considerations

Sentry free tier includes:
- 5,000 errors/month
- 10,000 performance units/month
- 30-day retention

For production, consider:
- Setting `tracesSampleRate: 0.1` (10% of transactions)
- Using error rate filters to reduce noise
- Upgrading to paid plan if needed

## Files Modified

### Created:
- sentry.client.config.ts
- sentry.server.config.ts
- sentry.edge.config.ts
- lib/monitoring/sentry.ts
- scripts/add-sentry-to-routes.ts (build tool)

### Modified:
- next.config.js
- scripts/start-digest-worker.ts
- lib/jobs/always-on-digest.ts
- 51 API route files (app/api/**/route.ts)

## Support

For issues or questions:
- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Sentry Support: https://sentry.io/support/
