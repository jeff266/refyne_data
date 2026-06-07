# Refyne Data Platform

Data enrichment platform with HubSpot integration.

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for billing)
- Clerk account (for authentication)

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```bash
# Stripe (Test Mode for Development)
STRIPE_TEST_MODE=true
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_live_...  # Production only
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installation

```bash
npm install
```

### Running the Dev Server

```bash
npm run dev
```

Server runs on http://localhost:3000

### Testing Stripe Webhooks Locally

Stripe webhooks cannot reach localhost by default. To test webhook events during development:

1. **Install Stripe CLI:**
   ```bash
   brew install stripe/stripe-cli/stripe
   # or download from https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to localhost:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **In a separate terminal, start the dev server:**
   ```bash
   npm run dev
   ```

5. **Test checkout flow:**
   - Navigate to http://localhost:3000/billing/upgrade
   - Complete checkout with test card: `4242 4242 4242 4242`
   - Stripe CLI will forward webhook events to your local server
   - Check server logs for webhook processing

The Stripe CLI will output a webhook signing secret (`whsec_...`) - add this to your `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### Verification Scripts

**Verify Stripe test mode configuration:**
```bash
npx tsx scripts/verify-test-mode.ts
```

**Check subscription status:**
```bash
npx tsx scripts/check-subscription-status.ts
```

**Seed Stripe test prices:**
```bash
npx tsx scripts/seed-stripe-test-prices.ts
```

### Building for Production

```bash
npm run build
npm start
```

### Testing

```bash
# Run tests
npm test

# E2E checkout test (requires dev server running)
npx tsx scripts/test-checkout-e2e.ts
```

## Project Structure

```
frontend/
├── app/                    # Next.js app router
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes
│   └── (auth)/            # Auth routes (sign-in, sign-up)
├── components/            # React components
├── lib/                   # Utilities and helpers
│   ├── billing/          # Stripe integration
│   ├── auth/             # Clerk authentication
│   └── db/               # Supabase client
├── scripts/              # Development scripts
└── public/               # Static assets
```

## Key Features

- **Stripe Billing**: Subscription management with test/live mode switching
- **Clerk Auth**: User authentication and organization management
- **Supabase**: PostgreSQL database with Row Level Security
- **HubSpot Integration**: CRM data enrichment
- **Real-time**: BullMQ job queue with webhook processing

## Contributing

When testing billing features:
1. Always use `STRIPE_TEST_MODE=true` in development
2. Use Stripe CLI for webhook testing
3. Never commit real API keys to the repository
4. Run verification scripts before pushing

## License

Proprietary
