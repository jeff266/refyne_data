-- Migration 028: Dedup Domain Exclusions
-- Admin-configurable list of domains to exclude from dedup matching
-- Generic domains (facebook.com, linkedin.com, etc.) create false positives

-- Create domain exclusions table
CREATE TABLE IF NOT EXISTS dedup_domain_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  domain text NOT NULL,
  is_preset boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT dedup_domain_exclusions_unique UNIQUE(org_id, domain)
);

-- Index for org-based lookups
CREATE INDEX IF NOT EXISTS dedup_domain_exclusions_org_id_idx
  ON dedup_domain_exclusions(org_id);

-- Index for domain lookups
CREATE INDEX IF NOT EXISTS dedup_domain_exclusions_domain_idx
  ON dedup_domain_exclusions(domain);

-- Enable RLS
ALTER TABLE dedup_domain_exclusions ENABLE ROW LEVEL SECURITY;

-- RLS policy for org isolation
DROP POLICY IF EXISTS "org_isolation" ON dedup_domain_exclusions;
CREATE POLICY "org_isolation" ON dedup_domain_exclusions
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Seed preset domains for all existing workspaces
INSERT INTO dedup_domain_exclusions (org_id, domain, is_preset)
SELECT
  w.org_id,
  d.domain,
  true
FROM workspace_entitlements w
CROSS JOIN (VALUES
  ('facebook.com'),
  ('linkedin.com'),
  ('instagram.com'),
  ('yelp.com'),
  ('youtube.com'),
  ('twitter.com'),
  ('x.com'),
  ('google.com'),
  ('healthgrades.com')
) AS d(domain)
ON CONFLICT (org_id, domain) DO NOTHING;

-- Add comment for migration tracking
COMMENT ON TABLE dedup_domain_exclusions IS 'Migration 028: Configurable list of domains excluded from dedup matching (social media, directories, generic domains)';
COMMENT ON COLUMN dedup_domain_exclusions.is_preset IS 'True for system-managed presets, false for user-added custom exclusions';
