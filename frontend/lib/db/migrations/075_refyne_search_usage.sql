-- Migration: 075_refyne_search_usage.sql
-- Usage tracking and metering for Refyne Search enrichment
-- Tracks API calls, token usage, costs per field lookup

CREATE TABLE refyne_search_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  domain text NOT NULL,
  field_key text NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  confidence numeric,
  serper_calls integer NOT NULL DEFAULT 0,
  jina_fetched boolean NOT NULL DEFAULT false,
  deepseek_input_tokens integer NOT NULL DEFAULT 0,
  deepseek_output_tokens integer NOT NULL DEFAULT 0,
  haiku_input_tokens integer NOT NULL DEFAULT 0,
  haiku_output_tokens integer NOT NULL DEFAULT 0,
  model_used text, -- 'deepseek' | 'haiku' | 'cache'
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX refyne_search_usage_org_created ON refyne_search_usage (org_id, created_at DESC);
CREATE INDEX refyne_search_usage_org_domain ON refyne_search_usage (org_id, domain);
CREATE INDEX refyne_search_usage_model ON refyne_search_usage (org_id, model_used) WHERE model_used IS NOT NULL;

-- Row-level security
ALTER TABLE refyne_search_usage ENABLE ROW LEVEL SECURITY;

-- App code uses service_role bypass for writes, but RLS protects against direct access
CREATE POLICY "org_isolation" ON refyne_search_usage
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- Service role (app code) has full access
CREATE POLICY "service_role_full_access" ON refyne_search_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
