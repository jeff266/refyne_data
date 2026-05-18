-- Migration: 016_notification_subscriptions.sql
-- Notification subscription preferences per user

CREATE TABLE notification_subscriptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            text        NOT NULL,
  user_id           text        NOT NULL,
  user_email        text        NOT NULL,
  notification_type text        NOT NULL
    CHECK (notification_type IN (
      'always_on_digest',
      'compliance_threshold_alert',
      'dedup_pairs_detected',
      'quarantine_submitted',
      'quarantine_decided',
      'credit_limit_warning',
      'member_joined'
    )),
  subscribed        boolean     NOT NULL DEFAULT true,
  mandatory         boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, notification_type)
);

CREATE INDEX notif_org_user
  ON notification_subscriptions (org_id, user_id);
CREATE INDEX notif_org_type_subscribed
  ON notification_subscriptions (org_id, notification_type, subscribed);

ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON notification_subscriptions
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Default subscriptions by role (applied at invite/join time):
-- Admin:    always_on_digest(on), compliance_threshold_alert(on),
--           dedup_pairs_detected(on), quarantine_submitted(mandatory),
--           credit_limit_warning(mandatory), member_joined(on)
-- Operator: quarantine_decided(mandatory), credit_limit_warning(mandatory),
--           always_on_digest(off), compliance_threshold_alert(off),
--           dedup_pairs_detected(off)
-- Viewer:   credit_limit_warning(mandatory only if limits applied)
