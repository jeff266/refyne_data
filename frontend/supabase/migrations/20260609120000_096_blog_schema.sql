-- Blog posts table
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body_json JSONB NOT NULL DEFAULT '{}', -- Tiptap JSON
  body_html TEXT,                         -- Rendered HTML for SSG
  cover_image_url TEXT,
  cover_image_alt TEXT,

  -- Media
  media JSONB DEFAULT '[]',
  -- [{ type: 'gif'|'video'|'image'|'meme', url, caption }]

  -- Taxonomy
  tag TEXT NOT NULL DEFAULT 'general',
  -- 'product'|'revops'|'ai'|'case-study'|'announcement'|'general'

  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,

  -- Publishing
  status TEXT NOT NULL DEFAULT 'draft',
  -- 'draft'|'review'|'published'|'archived'
  published_at TIMESTAMPTZ,
  author_name TEXT NOT NULL DEFAULT 'Refyne Team',
  author_avatar_url TEXT,
  read_time INTEGER, -- minutes, auto-calculated
  featured BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT -- Clerk user_id
);

-- Indexes
CREATE UNIQUE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_posts_tag ON blog_posts(tag, status);
CREATE INDEX idx_blog_posts_featured ON blog_posts(featured)
  WHERE status = 'published';

-- RLS: public can read published posts, staff can write
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY blog_posts_staff_all ON blog_posts
  FOR ALL TO service_role USING (true);

-- Media storage tracking
CREATE TABLE public.blog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- Supabase Storage path
  media_type TEXT NOT NULL,   -- 'image'|'gif'|'video'|'meme'
  filename TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_blog_media_post ON blog_media(post_id);

ALTER TABLE blog_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY blog_media_public_read ON blog_media
  FOR SELECT USING (true);
CREATE POLICY blog_media_staff_all ON blog_media
  FOR ALL TO service_role USING (true);
