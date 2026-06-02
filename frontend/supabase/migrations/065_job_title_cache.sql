-- Job Title Cache for AI-powered classification
-- Stores Claude Haiku classifications to avoid re-classifying the same titles

CREATE TABLE public.job_title_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_title TEXT NOT NULL,
  job_level TEXT NOT NULL,
  job_function TEXT NOT NULL,
  confidence TEXT DEFAULT 'high',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raw_title)
);

CREATE INDEX idx_job_title_cache_raw ON job_title_cache(lower(raw_title));

COMMENT ON TABLE public.job_title_cache IS 'Cache for AI-classified job titles to avoid redundant API calls';
COMMENT ON COLUMN public.job_title_cache.raw_title IS 'Original job title from HubSpot';
COMMENT ON COLUMN public.job_title_cache.job_level IS 'Classified level: C-Suite, VP, Director, Manager, IC, Founder, Other';
COMMENT ON COLUMN public.job_title_cache.job_function IS 'Classified function: Clinical/Healthcare, Revenue Operations, Sales, etc.';
COMMENT ON COLUMN public.job_title_cache.confidence IS 'Classification confidence: high or low';
