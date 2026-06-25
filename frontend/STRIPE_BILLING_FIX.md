# Stripe Billing Fix - Test vs Live Price IDs

## The Problem

Your production environment has:
- ✅ LIVE Stripe API keys (`STRIPE_SECRET_KEY` starts with `sk_live_`)
- ❌ TEST mode price IDs in the `stripe_prices` database table

When users try to checkout, Stripe rejects the request:
```
No such price: 'price_1TfWgvD7K17UO95d6lXJvXL6'
a similar object exists in test mode, but a live mode key was used
```

## The Solution

You need to replace the TEST price IDs in your database with LIVE price IDs.

There are 3 ways to do this:

---

## Option 1: Use Existing Live Prices (Recommended if already created)

If you've already created products in Stripe dashboard:

1. **List existing LIVE prices:**
   ```bash
   # Use the LIVE key from Vercel/Railway environment
   STRIPE_SECRET_KEY=sk_live_YOUR_KEY npx tsx scripts/list-stripe-live-prices.ts
   ```

2. **Manually update database:**
   Use Supabase dashboard or SQL to update the `stripe_prices` table with the LIVE price IDs.

---

## Option 2: Create New Live Prices via Script

If you haven't created products yet:

1. **Get your LIVE Stripe key** from Vercel/Railway environment variables

2. **Update `.env.local`** with the LIVE key:
   ```bash
   STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
   ```

3. **Run the seed script:**
   ```bash
   npx tsx scripts/seed-stripe-live-prices.ts
   ```
   This creates products and prices in Stripe LIVE mode.

4. **Update the database:**
   ```bash
   npx tsx scripts/update-to-live-prices.ts
   ```
   This updates the `stripe_prices` table with the new LIVE price IDs.

---

## Option 3: Create Prices in Stripe Dashboard

1. Go to Stripe Dashboard → Products
2. Create products with these prices:

   **Refyne Starter**
   - Monthly: $149/mo
   - Annual: $1,428/yr ($119/mo)

   **Refyne Growth**
   - Monthly: $249/mo
   - Annual: $2,388/yr ($199/mo)

   **Refyne Scale**
   - Monthly: $399/mo
   - Annual: $3,828/yr ($319/mo)

3. For each price, add metadata:
   ```
   tier: starter|growth|scale
   billing_period: monthly|annual
   ```

4. Copy the price IDs and update the database manually.

---

## Verify the Fix

After updating, run this to verify:

```bash
npx tsx scripts/check-stripe-prices.ts
```

All prices should show `[LIVE]` instead of `[TEST]`.

---

## Current Database State

Based on `update-to-test-prices.ts`, your database currently has these TEST price IDs:

| Tier    | Period  | Price ID (TEST)                   |
|---------|---------|-----------------------------------|
| starter | monthly | price_1TfWguD7K17UO95ddE4l6c3v    |
| starter | annual  | price_1TfWgvD7K17UO95dYrUkv5hB    |
| growth  | monthly | price_1TfWgvD7K17UO95d6lXJvXL6    | ← This one in error
| growth  | annual  | price_1TfWgwD7K17UO95dJS24xKci    |
| scale   | monthly | price_1TfWgwD7K17UO95d4UxFhVzn    |
| scale   | annual  | price_1TfWgxD7K17UO95dbcb0UzJL    |

These need to be replaced with LIVE price IDs.
