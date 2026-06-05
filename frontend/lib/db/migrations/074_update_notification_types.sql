-- Migration: 074_update_notification_types.sql
-- Update notification_subscriptions CHECK constraint to remove deprecated types and add new ones
-- Removes: quarantine_submitted, quarantine_decided
-- Adds: enrich_run_complete, normalize_run_complete

-- Step 1: Drop the existing CHECK constraint
-- The constraint was created inline, so we need to find its auto-generated name
DO $$
DECLARE
  constraint_name_var text;
BEGIN
  -- Find the CHECK constraint on notification_type column
  SELECT con.conname INTO constraint_name_var
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'notification_subscriptions'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%notification_type%';

  -- Drop the constraint if found
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notification_subscriptions DROP CONSTRAINT %I', constraint_name_var);
  END IF;
END $$;

-- Step 2: Add new named CHECK constraint with updated notification types
ALTER TABLE notification_subscriptions
  ADD CONSTRAINT notification_subscriptions_type_check
  CHECK (notification_type IN (
    'always_on_digest',
    'compliance_threshold_alert',
    'dedup_pairs_detected',
    'enrich_run_complete',
    'normalize_run_complete',
    'credit_limit_warning',
    'member_joined'
  ));

-- Note: Existing rows with quarantine_submitted or quarantine_decided will be preserved
-- but no new rows can be inserted with those types.
-- If you want to migrate existing rows, add data migration steps here.
