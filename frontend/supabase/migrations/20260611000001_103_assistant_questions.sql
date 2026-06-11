-- Migration 103: Assistant question logging and dynamic suggestions
-- Created: 2026-06-11
-- Purpose: Track assistant questions for analytics and dynamic suggestion generation

-- ═══════════════════════════════════════════════════════════════════════════════
-- Table: assistant_questions (individual question logs)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assistant_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  question_normalized TEXT NOT NULL,
  suggestion_clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assistant_questions_org_id ON assistant_questions(org_id);
CREATE INDEX IF NOT EXISTS idx_assistant_questions_normalized ON assistant_questions(question_normalized);
CREATE INDEX IF NOT EXISTS idx_assistant_questions_created_at ON assistant_questions(created_at DESC);

-- RLS: org isolation
ALTER TABLE assistant_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_questions_org_isolation ON assistant_questions
  FOR ALL
  USING (org_id = (auth.jwt() ->> 'org_id'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- Table: assistant_question_patterns (aggregated pattern analytics)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assistant_question_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_normalized TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 1,
  example_question TEXT NOT NULL,
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_suggested BOOLEAN DEFAULT false,
  suggested_prompt_text TEXT,
  suggested_prompt_icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assistant_patterns_count ON assistant_question_patterns(count DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_patterns_suggested ON assistant_question_patterns(is_suggested) WHERE is_suggested = true;
CREATE INDEX IF NOT EXISTS idx_assistant_patterns_normalized ON assistant_question_patterns(question_normalized);

-- RLS: read-only (all users can read, only service role can write)
ALTER TABLE assistant_question_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_patterns_read_all ON assistant_question_patterns
  FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Trigger: increment_question_count
-- ═══════════════════════════════════════════════════════════════════════════════
-- Automatically update assistant_question_patterns when a new question is logged
-- Increments count for existing patterns or creates new pattern

CREATE OR REPLACE FUNCTION increment_question_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO assistant_question_patterns (
    question_normalized,
    count,
    example_question,
    last_asked_at
  )
  VALUES (
    NEW.question_normalized,
    1,
    NEW.question,
    NEW.created_at
  )
  ON CONFLICT (question_normalized)
  DO UPDATE SET
    count = assistant_question_patterns.count + 1,
    last_asked_at = NEW.created_at,
    example_question = CASE
      WHEN assistant_question_patterns.last_asked_at < NEW.created_at
      THEN NEW.question
      ELSE assistant_question_patterns.example_question
    END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_question_count
  AFTER INSERT ON assistant_questions
  FOR EACH ROW
  EXECUTE FUNCTION increment_question_count();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed data: Default suggested prompts
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO assistant_question_patterns (
  question_normalized,
  count,
  example_question,
  is_suggested,
  suggested_prompt_text,
  suggested_prompt_icon
)
VALUES
  ('how normalize phone numbers', 10, 'How do I normalize phone numbers?', true, 'How do I normalize phone numbers?', 'Phone'),
  ('whats grade duplicate', 8, 'What''s a Grade A duplicate?', true, 'What''s a Grade A duplicate?', 'GitMerge'),
  ('how merge survivor work', 7, 'How does the merge survivor work?', true, 'How does the merge survivor work?', 'Shield'),
  ('how import contact list', 6, 'How do I import a contact list?', true, 'How do I import a contact list?', 'Upload')
ON CONFLICT (question_normalized) DO NOTHING;
