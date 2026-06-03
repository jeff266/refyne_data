-- Migration 072: Taxonomy Manager
--
-- Enables taxonomy classification with global packs, AI-powered suggestions,
-- and NAICS-anchored mapping for vertical industries.

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: Global Taxonomy Packs
-- ═══════════════════════════════════════════════════════════════════════════

-- Refyne's global vertical taxonomy packs
CREATE TABLE IF NOT EXISTS sub_industry_packs (
  id TEXT PRIMARY KEY,
  -- 'healthcare-aba', 'saas-tech', 'media-entertainment', 'financial-services'
  name TEXT NOT NULL,
  -- 'Healthcare / ABA', 'SaaS / Technology'
  description TEXT,
  industry_scope TEXT[],
  -- HubSpot industry enums this pack is relevant for
  -- ['MENTAL_HEALTH_CARE', 'HOSPITAL_HEALTH_CARE', 'MEDICAL_PRACTICE']
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The actual mappings inside each pack
CREATE TABLE IF NOT EXISTS sub_industry_pack_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id TEXT NOT NULL REFERENCES sub_industry_packs(id) ON DELETE CASCADE,
  input_value TEXT NOT NULL,
  canonical_value TEXT NOT NULL,
  naics_code TEXT,
  -- optional NAICS anchor for CRM-agnostic matching
  confidence TEXT DEFAULT 'high',
  -- 'high' | 'medium' | 'low'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_entries_pack ON sub_industry_pack_entries(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_entries_input ON sub_industry_pack_entries(LOWER(input_value));
CREATE UNIQUE INDEX IF NOT EXISTS idx_pack_entries_unique ON sub_industry_pack_entries(pack_id, LOWER(input_value));

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: Extend Harmony Reference Data
-- ═══════════════════════════════════════════════════════════════════════════

-- Add pack origin and NAICS tracking
ALTER TABLE harmony_reference_data
ADD COLUMN IF NOT EXISTS pack_id TEXT,
ADD COLUMN IF NOT EXISTS naics_code TEXT,
ADD COLUMN IF NOT EXISTS suggestion_status TEXT DEFAULT NULL;
-- NULL = manually added
-- 'accepted' = user accepted AI suggestion
-- 'rejected' = user rejected suggestion
-- 'pending' = surfaced by suggester, not yet reviewed

-- Unique constraint to prevent duplicates (org-scoped)
CREATE UNIQUE INDEX IF NOT EXISTS idx_harmony_ref_unique
ON harmony_reference_data (table_name, org_id, LOWER(input_value))
WHERE org_id IS NOT NULL;

-- Unique constraint for global reference data
CREATE UNIQUE INDEX IF NOT EXISTS idx_harmony_ref_global_unique
ON harmony_reference_data (table_name, LOWER(input_value))
WHERE org_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3: AI Suggestion System
-- ═══════════════════════════════════════════════════════════════════════════

-- Tracks unmapped values found during suggestion scan
CREATE TABLE IF NOT EXISTS taxonomy_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  harmony_id TEXT NOT NULL REFERENCES harmonies(id) ON DELETE CASCADE,
  raw_value TEXT NOT NULL,
  -- the unmapped value found in HubSpot
  suggested_canonical TEXT,
  -- Haiku's suggestion
  confidence TEXT,
  -- 'high' | 'medium' | 'low' | 'unsure'
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'rejected'
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, harmony_id, raw_value)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_suggestions_org
ON taxonomy_suggestions(org_id, harmony_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 4: Seed Initial Packs
-- ═══════════════════════════════════════════════════════════════════════════

-- Pack 1: Healthcare / ABA
INSERT INTO sub_industry_packs (id, name, description, industry_scope) VALUES
('healthcare-aba', 'Healthcare / ABA',
 'Applied Behavior Analysis, autism services, and behavioral health providers',
 ARRAY['MENTAL_HEALTH_CARE', 'HOSPITAL_HEALTH_CARE', 'MEDICAL_PRACTICE'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO sub_industry_pack_entries (pack_id, input_value, canonical_value, naics_code) VALUES
('healthcare-aba', 'ABA therapy', 'ABA Therapy', '624120'),
('healthcare-aba', 'aba', 'ABA Therapy', '624120'),
('healthcare-aba', 'Applied Behavior Analysis', 'ABA Therapy', '624120'),
('healthcare-aba', 'applied behavior analysis', 'ABA Therapy', '624120'),
('healthcare-aba', 'behavior analysis', 'ABA Therapy', '624120'),
('healthcare-aba', 'behaviour analysis', 'ABA Therapy', '624120'),
('healthcare-aba', 'Applied Behavioural Analysis', 'ABA Therapy', '624120'),
('healthcare-aba', 'BCBA services', 'ABA Therapy', '624120'),
('healthcare-aba', 'home based aba', 'ABA Therapy', '624120'),
('healthcare-aba', 'in home aba', 'ABA Therapy', '624120'),
('healthcare-aba', 'center based aba', 'ABA Therapy', '624120'),
('healthcare-aba', 'Multi-Location ABA Group', 'Multi-Location ABA Group', '624120'),
('healthcare-aba', 'ABA group', 'Multi-Location ABA Group', '624120'),
('healthcare-aba', 'autism services', 'Autism Services', '624120'),
('healthcare-aba', 'autism therapy', 'Autism Services', '624120'),
('healthcare-aba', 'autism treatment', 'Autism Services', '624120'),
('healthcare-aba', 'autism spectrum disorder', 'Autism Services', '624120'),
('healthcare-aba', 'ASD services', 'Autism Services', '624120'),
('healthcare-aba', 'early intervention', 'Early Intervention', '624120'),
('healthcare-aba', 'developmental disabilities', 'Early Intervention', '624310'),
('healthcare-aba', 'special education services', 'Early Intervention', '611110'),
('healthcare-aba', 'behavioral health', 'Behavioral Health', '621420'),
('healthcare-aba', 'behavioral health services', 'Behavioral Health', '621420'),
('healthcare-aba', 'mental health', 'Mental Health', '621420'),
('healthcare-aba', 'psychotherapy', 'Mental Health', '621420'),
('healthcare-aba', 'counseling services', 'Mental Health', '621420'),
('healthcare-aba', 'speech therapy', 'Speech & Language Therapy', '621340'),
('healthcare-aba', 'occupational therapy', 'Occupational Therapy', '621340'),
('healthcare-aba', 'physical therapy', 'Physical Therapy', '621340'),
('healthcare-aba', 'private practice', 'Private Practice', '621112')
ON CONFLICT (pack_id, input_value) DO NOTHING;

-- Pack 2: SaaS / Technology
INSERT INTO sub_industry_packs (id, name, description, industry_scope) VALUES
('saas-tech', 'SaaS / Technology',
 'B2B software, developer tools, data platforms, and vertical SaaS',
 ARRAY['COMPUTER_SOFTWARE', 'INFORMATION_TECHNOLOGY_AND_SERVICES',
       'INTERNET', 'COMPUTER_NETWORK_SECURITY'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO sub_industry_pack_entries (pack_id, input_value, canonical_value, naics_code) VALUES
('saas-tech', 'revenue operations', 'RevOps / Sales Tech', '511210'),
('saas-tech', 'sales software', 'RevOps / Sales Tech', '511210'),
('saas-tech', 'CRM', 'RevOps / Sales Tech', '511210'),
('saas-tech', 'marketing automation', 'Marketing Tech', '511210'),
('saas-tech', 'demand generation', 'Marketing Tech', '511210'),
('saas-tech', 'data analytics', 'Data & Analytics', '511210'),
('saas-tech', 'business intelligence', 'Data & Analytics', '511210'),
('saas-tech', 'developer tools', 'DevTools', '511210'),
('saas-tech', 'developer platform', 'DevTools', '511210'),
('saas-tech', 'cybersecurity', 'Security', '541512'),
('saas-tech', 'information security', 'Security', '541512'),
('saas-tech', 'fintech', 'FinTech', '522320'),
('saas-tech', 'financial technology', 'FinTech', '522320'),
('saas-tech', 'HR software', 'HR Tech', '511210'),
('saas-tech', 'human resources software', 'HR Tech', '511210'),
('saas-tech', 'AI platform', 'AI / ML', '511210'),
('saas-tech', 'machine learning', 'AI / ML', '511210'),
('saas-tech', 'vertical saas', 'Vertical SaaS', '511210'),
('saas-tech', 'infrastructure', 'Infrastructure', '517311'),
('saas-tech', 'cloud infrastructure', 'Infrastructure', '517311')
ON CONFLICT (pack_id, input_value) DO NOTHING;

-- Pack 3: Media / Entertainment (for MPLC)
INSERT INTO sub_industry_packs (id, name, description, industry_scope) VALUES
('media-entertainment', 'Media / Entertainment',
 'Music, film, TV, sports licensing, publishing, and digital media',
 ARRAY['ENTERTAINMENT', 'BROADCAST_MEDIA', 'MUSIC', 'PUBLISHING',
       'MOTION_PICTURES_AND_FILM'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO sub_industry_pack_entries (pack_id, input_value, canonical_value, naics_code) VALUES
('media-entertainment', 'music licensing', 'Music Licensing', '512230'),
('media-entertainment', 'music rights', 'Music Licensing', '512230'),
('media-entertainment', 'performance rights', 'Music Licensing', '512230'),
('media-entertainment', 'synchronization licensing', 'Music Licensing', '512230'),
('media-entertainment', 'film licensing', 'Film & TV Licensing', '512110'),
('media-entertainment', 'TV licensing', 'Film & TV Licensing', '515120'),
('media-entertainment', 'television licensing', 'Film & TV Licensing', '515120'),
('media-entertainment', 'broadcast licensing', 'Broadcast Licensing', '515120'),
('media-entertainment', 'sports licensing', 'Sports Licensing', '711211'),
('media-entertainment', 'digital media', 'Digital Media', '519130'),
('media-entertainment', 'streaming', 'Digital Media', '519130'),
('media-entertainment', 'publishing', 'Publishing', '511130'),
('media-entertainment', 'restaurant chain', 'Restaurant & Hospitality', '722511'),
('media-entertainment', 'restaurant', 'Restaurant & Hospitality', '722511'),
('media-entertainment', 'hotel', 'Hospitality', '721110'),
('media-entertainment', 'hospitality', 'Hospitality', '721110'),
('media-entertainment', 'retail', 'Retail', '441110'),
('media-entertainment', 'general counsel', 'Legal', '541110')
ON CONFLICT (pack_id, input_value) DO NOTHING;
