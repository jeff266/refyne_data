-- Migration 056: Add survivorship_decisions column to dedup_merge_history
-- Stores which survivorship rule was applied to each field during merge

ALTER TABLE public.dedup_merge_history
ADD COLUMN IF NOT EXISTS survivorship_decisions jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.dedup_merge_history.survivorship_decisions IS 'Map of field_key to {rule, source} showing which survivorship rule was applied to each field';
