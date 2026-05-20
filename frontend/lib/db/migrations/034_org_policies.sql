-- Migration 034: Org Policies
-- Stores organization-level policy defaults for enrichment, dedup, quarantine, and scanning

create table if not exists org_policies (
  org_id                      text primary key,
  write_policy_default        text not null default 'fill_empty' check (write_policy_default in ('fill_empty', 'overwrite', 'per_field')),
  dedup_auto_merge_threshold  numeric check (dedup_auto_merge_threshold is null or (dedup_auto_merge_threshold >= 0 and dedup_auto_merge_threshold <= 100)),
  dedup_merge_survivor_rule   text not null default 'most_recent' check (dedup_merge_survivor_rule in ('most_recent', 'most_complete', 'oldest')),
  quarantine_threshold        int  not null default 40 check (quarantine_threshold >= 0 and quarantine_threshold <= 100),
  nightly_scan_enabled        boolean not null default true,
  incremental_scan_enabled    boolean not null default true,
  updated_at                  timestamptz default now()
);

-- RLS
alter table org_policies enable row level security;

create policy "org_isolation" on org_policies
  for all using (org_id = current_setting('app.org_id', true));

-- Index
create index if not exists org_policies_org_id_idx on org_policies(org_id);
