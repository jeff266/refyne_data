-- Migration: Normalization Settings Schema
-- Phase 9: Normalization Settings UI
--
-- Tables for storing org normalization preferences and pipeline configurations.

-- Normalization settings per org
create table if not exists normalization_settings (
  org_id     text primary key,
  mode       text not null default 'explicit' check (mode in ('implicit', 'explicit')),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table normalization_settings enable row level security;

-- Policy: orgs can only access their own settings
create policy "Orgs can view own settings"
  on normalization_settings for select
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can update own settings"
  on normalization_settings for update
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can insert own settings"
  on normalization_settings for insert
  with check (auth.jwt() ->> 'org_id' = org_id);

-- Pipelines table - stores named sets of Harmonies
create table if not exists pipelines (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null,
  name        text not null,
  harmony_ids text[] not null,
  is_default  boolean default false,
  created_at  timestamptz default now()
);

-- Index for org lookups
create index if not exists pipelines_org_id_idx on pipelines(org_id);

-- Ensure only one default pipeline per org
create unique index if not exists pipelines_org_default_idx
  on pipelines(org_id)
  where is_default = true;

-- Enable RLS
alter table pipelines enable row level security;

-- Policy: orgs can only access their own pipelines
create policy "Orgs can view own pipelines"
  on pipelines for select
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can insert own pipelines"
  on pipelines for insert
  with check (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can update own pipelines"
  on pipelines for update
  using (auth.jwt() ->> 'org_id' = org_id);

create policy "Orgs can delete own pipelines"
  on pipelines for delete
  using (auth.jwt() ->> 'org_id' = org_id);

-- Trigger to update updated_at on normalization_settings
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger normalization_settings_updated_at
  before update on normalization_settings
  for each row
  execute function update_updated_at_column();
