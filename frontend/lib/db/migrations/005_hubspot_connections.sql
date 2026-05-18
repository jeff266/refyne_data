-- Migration: HubSpot Connections Schema
-- H1: Connection + Read Path
--
-- Tables for storing HubSpot portal connections per org.
-- One org can have one portal in v1. Multi-portal is a v2 concern.

-- HubSpot connections table
create table if not exists hubspot_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null unique,       -- One portal per org in v1
  portal_id       text not null unique,       -- HubSpot portal ID
  encrypted_token text not null,              -- AES-256-GCM encrypted access token
  scopes          text[] not null,            -- Granted scopes
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Index for portal ID lookups (used by webhook handler)
create index if not exists hubspot_connections_portal_idx
  on hubspot_connections(portal_id);

-- Enable RLS
alter table hubspot_connections enable row level security;

-- Policy: orgs can only access their own connections
create policy "Orgs can view own hubspot connection"
  on hubspot_connections for select
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can insert own hubspot connection"
  on hubspot_connections for insert
  with check (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can update own hubspot connection"
  on hubspot_connections for update
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can delete own hubspot connection"
  on hubspot_connections for delete
  using (auth.jwt() ->> 'org_id' = org_id);

-- Trigger to update updated_at
create trigger hubspot_connections_updated_at
  before update on hubspot_connections
  for each row
  execute function update_updated_at_column();

-- Field mappings table (canonical ↔ HubSpot properties)
create table if not exists field_mappings (
  id               uuid primary key default gen_random_uuid(),
  org_id           text not null,
  canonical_field  text not null,
  hubspot_property text not null,
  direction        text not null default 'bidirectional'
                   check (direction in ('read', 'write', 'bidirectional')),
  write_policy     text not null default 'overwrite_if_blank_or_ours'
                   check (write_policy in ('always_overwrite', 'overwrite_if_blank_or_ours', 'never_overwrite')),
  valid_values     jsonb,                     -- For enumeration properties
  is_active        boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique(org_id, canonical_field)
);

-- Index for org lookups
create index if not exists field_mappings_org_idx
  on field_mappings(org_id);

-- Enable RLS
alter table field_mappings enable row level security;

-- Policy: orgs can only access their own field mappings
create policy "Orgs can view own field mappings"
  on field_mappings for select
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can insert own field mappings"
  on field_mappings for insert
  with check (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can update own field mappings"
  on field_mappings for update
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can delete own field mappings"
  on field_mappings for delete
  using (auth.jwt() ->> 'org_id' = org_id);

-- Trigger to update updated_at
create trigger field_mappings_updated_at
  before update on field_mappings
  for each row
  execute function update_updated_at_column();

-- Seed default field mappings function
create or replace function seed_default_field_mappings(p_org_id text)
returns void as $$
begin
  insert into field_mappings (org_id, canonical_field, hubspot_property)
  values
    (p_org_id, 'company.name', 'name'),
    (p_org_id, 'company.domain', 'domain'),
    (p_org_id, 'company.industry', 'industry'),
    (p_org_id, 'company.revenue', 'annualrevenue'),
    (p_org_id, 'company.employees', 'numberofemployees'),
    (p_org_id, 'company.phone', 'phone'),
    (p_org_id, 'company.address.country', 'country'),
    (p_org_id, 'company.address.state', 'state'),
    (p_org_id, 'company.address.city', 'city'),
    (p_org_id, 'company.address.street', 'address'),
    (p_org_id, 'company.address.postal_code', 'zip'),
    (p_org_id, 'company.linkedin_url', 'linkedin_company_page'),
    (p_org_id, 'company.description', 'description')
  on conflict (org_id, canonical_field) do nothing;
end;
$$ language plpgsql;
