-- Migration 030: Incremental Dedup Scanning
-- Adds persistence layer for incremental dedup with scan run tracking and blocking key index

-- ─────────────────────────────────────────────────────────────────────────────
-- Scan run tracking — one row per scan execution
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dedup_scan_runs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               text        NOT NULL,
  portal_id            text        NOT NULL,
  connection_id        uuid        REFERENCES hubspot_connections(id),
  scan_type            text        NOT NULL DEFAULT 'full'
    CHECK (scan_type IN ('full', 'incremental')),
  status               text        NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  started_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  records_scanned      int         NOT NULL DEFAULT 0,
  new_pairs_found      int         NOT NULL DEFAULT 0,
  new_clusters_found   int         NOT NULL DEFAULT 0,
  error_message        text,
  modified_cursor      timestamptz,
  -- HubSpot lastmodifieddate of most recently modified record
  -- used as cursor for next incremental scan
  UNIQUE (org_id, portal_id, started_at)
);

CREATE INDEX dedup_scan_runs_org_portal
  ON dedup_scan_runs (org_id, portal_id, started_at DESC);

ALTER TABLE dedup_scan_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON dedup_scan_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- Blocking key index — persisted between scans
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_dedup_index (
  org_id              text        NOT NULL,
  portal_id           text        NOT NULL,
  hubspot_company_id  text        NOT NULL,
  name_prefix         text,
  -- first 4 chars of name, lowercased, stripped of punctuation
  domain_normalized   text,
  -- stripped www, normalized TLD, null if generic domain
  phone_prefix        text,
  -- first 7 digits of E.164 phone, null if missing
  linkedin_id         text,
  -- extracted from linkedin_company_page URL
  name_full           text,
  -- full normalized name for fuzzy matching
  last_modified_at    timestamptz,
  -- HubSpot lastmodifieddate — used for incremental sync
  indexed_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, portal_id, hubspot_company_id)
);

CREATE INDEX company_dedup_index_domain
  ON company_dedup_index (org_id, portal_id, domain_normalized)
  WHERE domain_normalized IS NOT NULL;

CREATE INDEX company_dedup_index_phone
  ON company_dedup_index (org_id, portal_id, phone_prefix)
  WHERE phone_prefix IS NOT NULL;

CREATE INDEX company_dedup_index_name
  ON company_dedup_index (org_id, portal_id, name_prefix)
  WHERE name_prefix IS NOT NULL;

CREATE INDEX company_dedup_index_linkedin
  ON company_dedup_index (org_id, portal_id, linkedin_id)
  WHERE linkedin_id IS NOT NULL;

CREATE INDEX company_dedup_index_modified
  ON company_dedup_index (org_id, portal_id, last_modified_at DESC);

ALTER TABLE company_dedup_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON company_dedup_index
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Comment for migration tracking
COMMENT ON TABLE dedup_scan_runs IS 'Migration 030: Incremental dedup - scan run tracking and history';
COMMENT ON TABLE company_dedup_index IS 'Migration 030: Incremental dedup - blocking key index for fast candidate lookup';
