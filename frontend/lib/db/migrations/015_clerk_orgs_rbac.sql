-- Migration 015: Clerk Organizations + RBAC
-- Adds org-level settings, quarantine queue, and prospecting limits

-- Extend workspace_entitlements with org settings
ALTER TABLE workspace_entitlements
  ADD COLUMN IF NOT EXISTS clerk_org_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS org_name text,
  ADD COLUMN IF NOT EXISTS allow_operator_push boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_push_policy text NOT NULL DEFAULT 'block'
    CHECK (duplicate_push_policy IN ('block','quarantine','allow')),
  ADD COLUMN IF NOT EXISTS external_agencies_enabled boolean NOT NULL DEFAULT false;

-- Quarantine queue for records pending admin approval
CREATE TABLE IF NOT EXISTS quarantine_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  submitted_by text NOT NULL,
  submitted_name text,
  record_data jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('manual','csv','prospect')),
  duplicate_of text,
  confidence numeric(5,2),
  signals_fired jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prospecting limits (per user, role, or org-wide)
CREATE TABLE IF NOT EXISTS prospecting_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  applies_to text NOT NULL,
  credits_per_period int NOT NULL CHECK (credits_per_period > 0),
  period text NOT NULL CHECK (period IN ('day','week','month')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, applies_to)
);

-- Prospecting usage tracking
CREATE TABLE IF NOT EXISTS prospecting_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  user_id text NOT NULL,
  action text NOT NULL
    CHECK (action IN ('search','enrich_record','csv_row','prospect_push')),
  credits_used int NOT NULL DEFAULT 1,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS quarantine_org_status ON quarantine_records (org_id, status);
CREATE INDEX IF NOT EXISTS quarantine_created ON quarantine_records (created_at DESC);
CREATE INDEX IF NOT EXISTS usage_org_user_date ON prospecting_usage (org_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS usage_created ON prospecting_usage (created_at DESC);

-- Enable RLS on new tables
ALTER TABLE quarantine_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for org isolation
DROP POLICY IF EXISTS "org_isolation" ON quarantine_records;
CREATE POLICY "org_isolation" ON quarantine_records
  FOR ALL USING (org_id = current_setting('app.org_id', true));

DROP POLICY IF EXISTS "org_isolation" ON prospecting_limits;
CREATE POLICY "org_isolation" ON prospecting_limits
  FOR ALL USING (org_id = current_setting('app.org_id', true));

DROP POLICY IF EXISTS "org_isolation" ON prospecting_usage;
CREATE POLICY "org_isolation" ON prospecting_usage
  FOR ALL USING (org_id = current_setting('app.org_id', true));

-- Add comment for migration tracking
COMMENT ON TABLE quarantine_records IS 'Migration 015: Records pending admin approval due to duplicate detection';
COMMENT ON TABLE prospecting_limits IS 'Migration 015: Per-user/role prospecting credit limits';
COMMENT ON TABLE prospecting_usage IS 'Migration 015: Prospecting action usage tracking';
