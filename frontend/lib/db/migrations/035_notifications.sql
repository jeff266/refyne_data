-- Migration 035: Notification System
-- Stores org-wide notification event settings and user-specific preferences

-- Org-wide notification events (which events can generate notifications)
create table if not exists org_notification_events (
  org_id      text not null,
  event_key   text not null,
  enabled     boolean not null default true,
  primary key (org_id, event_key)
);

-- User notification preferences (how each user wants to be notified)
create table if not exists user_notification_prefs (
  org_id      text not null,
  user_id     text not null,
  event_key   text not null,
  email       boolean not null default true,
  in_app      boolean not null default true,
  primary key (org_id, user_id, event_key)
);

-- RLS
alter table org_notification_events enable row level security;
alter table user_notification_prefs enable row level security;

create policy "org_isolation" on org_notification_events
  for all using (org_id = current_setting('app.org_id', true));

create policy "org_isolation" on user_notification_prefs
  for all using (org_id = current_setting('app.org_id', true));

-- Indexes
create index if not exists org_notification_events_org_id_idx on org_notification_events(org_id);
create index if not exists user_notification_prefs_org_user_idx on user_notification_prefs(org_id, user_id);

-- Seed default events for all orgs (run separately or as part of org creation)
-- Event keys: nightly_digest, compliance_score_drop, dedup_cluster_ready,
--             arrangement_complete, arrangement_failed, quarantine_record_added,
--             team_member_joined
