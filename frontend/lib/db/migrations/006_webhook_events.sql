-- Migration: Webhook Events (Idempotency Log)
-- H4: Webhook + Real-Time
--
-- Stores HubSpot webhook events for idempotency checking and audit trail.
-- Events are deduplicated by hubspot_event_id to handle HubSpot's retry logic.

-- Webhook events table
create table if not exists webhook_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null,
  hubspot_event_id text not null,           -- HubSpot's eventId from payload
  portal_id       text not null,
  object_id       text not null,            -- HubSpot object ID (company, contact, etc.)
  event_type      text not null,            -- company.creation, company.propertyChange
  status          text not null default 'pending'
                  check (status in ('pending', 'processed', 'failed', 'duplicate')),
  property_name   text,                     -- For propertyChange events
  property_value  text,                     -- For propertyChange events
  attempt_number  integer not null default 0,
  error_message   text,                     -- Error details if failed
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  unique(org_id, hubspot_event_id)
);

-- Index for idempotency lookups (most common query)
create index if not exists webhook_events_lookup_idx
  on webhook_events(org_id, hubspot_event_id);

-- Index for finding pending events
create index if not exists webhook_events_status_idx
  on webhook_events(status) where status = 'pending';

-- Index for portal lookups
create index if not exists webhook_events_portal_idx
  on webhook_events(portal_id);

-- Index for object ID lookups (find all events for a company)
create index if not exists webhook_events_object_idx
  on webhook_events(portal_id, object_id);

-- Enable RLS
alter table webhook_events enable row level security;

-- Policy: orgs can view their own webhook events
create policy "Orgs can view own webhook events"
  on webhook_events for select
  using (auth.jwt() ->> 'org_id' = org_id);

-- Policy: allow inserts for service role (webhook handler)
-- In production, this would be restricted to service role
create policy "Service role can insert webhook events"
  on webhook_events for insert
  with check (true);

-- Policy: allow updates for service role (processing updates)
create policy "Service role can update webhook events"
  on webhook_events for update
  using (true);
