-- Single function handles both global + org lookup
-- Returns canonical form or null if not in registry
CREATE OR REPLACE FUNCTION public.lookup_name_registry(
  p_org_id TEXT,
  p_registry_type TEXT,
  p_input_token TEXT
) RETURNS TEXT AS $$
DECLARE
  v_canonical TEXT;
BEGIN
  -- Normalize input for lookup
  p_input_token := LOWER(TRIM(p_input_token));

  -- 1. Check org-specific registry first
  SELECT canonical_form INTO v_canonical
  FROM name_registry
  WHERE org_id = p_org_id
    AND registry_type = p_registry_type
    AND input_token = p_input_token
    AND status = 'active'
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    RETURN v_canonical;
  END IF;

  -- 2. Fall back to global registry
  SELECT canonical_form INTO v_canonical
  FROM name_registry
  WHERE org_id IS NULL
    AND registry_type = p_registry_type
    AND input_token = p_input_token
    AND status = 'active'
  LIMIT 1;

  RETURN v_canonical; -- null if not found
END;
$$ LANGUAGE plpgsql STABLE;
