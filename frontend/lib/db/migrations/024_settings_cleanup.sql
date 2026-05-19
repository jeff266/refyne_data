/**
 * Migration 024: Settings Cleanup
 *
 * Add timezone and display_name to workspace_entitlements
 * for Settings → General tab configuration.
 */

-- Add timezone column (defaults to UTC)
ALTER TABLE workspace_entitlements
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- Add display_name column (overrides Clerk org name for display)
ALTER TABLE workspace_entitlements
  ADD COLUMN IF NOT EXISTS display_name text;

-- Create index for timezone queries
CREATE INDEX IF NOT EXISTS idx_workspace_entitlements_timezone
  ON workspace_entitlements(timezone);

COMMENT ON COLUMN workspace_entitlements.timezone IS 'Workspace timezone (IANA format, e.g., America/Los_Angeles). Used for Always On digest time display.';
COMMENT ON COLUMN workspace_entitlements.display_name IS 'Custom display name for the workspace. Overrides Clerk org name if set.';
