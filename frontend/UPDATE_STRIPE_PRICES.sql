-- Update stripe_prices table with LIVE price IDs
--
-- INSTRUCTIONS:
-- 1. Go to Stripe Dashboard → Products: https://dashboard.stripe.com/products
-- 2. Find/Create these 3 products with 2 prices each (monthly + annual)
-- 3. Copy the price IDs (starts with price_) and replace below
-- 4. Run this SQL in Supabase SQL Editor

-- Starter Monthly ($149/mo)
UPDATE stripe_prices
SET stripe_price_id = 'price_REPLACE_WITH_LIVE_ID'
WHERE tier = 'starter' AND billing_period = 'monthly';

-- Starter Annual ($1,428/yr = $119/mo)
UPDATE stripe_prices
SET stripe_price_id = 'price_REPLACE_WITH_LIVE_ID'
WHERE tier = 'starter' AND billing_period = 'annual';

-- Growth Monthly ($249/mo)
UPDATE stripe_prices
SET stripe_price_id = 'price_REPLACE_WITH_LIVE_ID'
WHERE tier = 'growth' AND billing_period = 'monthly';

-- Growth Annual ($2,388/yr = $199/mo)
UPDATE stripe_prices
SET stripe_price_id = 'price_REPLACE_WITH_LIVE_ID'
WHERE tier = 'growth' AND billing_period = 'annual';

-- Scale Monthly ($399/mo)
UPDATE stripe_prices
SET stripe_price_id = 'price_REPLACE_WITH_LIVE_ID'
WHERE tier = 'scale' AND billing_period = 'monthly';

-- Scale Annual ($3,828/yr = $319/mo)
UPDATE stripe_prices
SET stripe_price_id = 'price_REPLACE_WITH_LIVE_ID'
WHERE tier = 'scale' AND billing_period = 'annual';

-- Verify the update
SELECT tier, billing_period, stripe_price_id, amount_cents
FROM stripe_prices
ORDER BY tier, billing_period;
