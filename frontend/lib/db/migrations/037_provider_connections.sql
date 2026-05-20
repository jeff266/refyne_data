-- Migration 037: Provider Connections
-- Stores encrypted API keys for BYOK enrichment providers

create table if not exists provider_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null,
  provider        text not null,
  api_key_enc     text not null,
  key_hint        text not null,
  status          text not null default 'active' check (status in ('active', 'error', 'revoked')),
  last_tested_at  timestamptz,
  last_error      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (org_id, provider)
);

-- RLS
alter table provider_connections enable row level security;

create policy "org_isolation" on provider_connections
  for all using (org_id = current_setting('app.org_id', true));

-- Index
create index if not exists provider_connections_org_id_idx on provider_connections(org_id);
