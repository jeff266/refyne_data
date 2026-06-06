-- Migration 083: Trial Email Tracking
-- Add timestamp columns to track when trial warning and expiry emails were sent

ALTER TABLE org_billing
  ADD COLUMN trial_warning_email_sent_at TIMESTAMPTZ,
  ADD COLUMN trial_expiry_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN org_billing.trial_warning_email_sent_at IS 'Timestamp when 3-day trial warning email was sent';
COMMENT ON COLUMN org_billing.trial_expiry_email_sent_at IS 'Timestamp when trial expiry email was sent';
