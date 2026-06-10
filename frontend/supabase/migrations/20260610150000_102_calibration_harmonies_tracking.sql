/**
 * Migration 102: Track Which Harmonies Were Configured During Calibration
 *
 * Context:
 * During onboarding calibration, users select phone format, company name casing, etc.
 * This activates specific harmonies, but we weren't tracking WHICH harmonies were selected.
 * Users want to see a summary of what was configured during calibration.
 *
 * Changes:
 * - Add calibration_harmonies JSONB column to onboarding_progress table
 * - Stores array of harmony IDs that were configured during calibration
 * - Example: ["phone", "company-name", "company-domain", "address-country", "address-state"]
 *
 * Author: Claude Sonnet 4.5
 * Date: 2026-06-10
 */

-- Add calibration_harmonies column to track which harmonies were configured during calibration
ALTER TABLE onboarding_progress
ADD COLUMN IF NOT EXISTS calibration_harmonies JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN onboarding_progress.calibration_harmonies IS
'Array of harmony IDs that were configured during the calibration wizard. Example: ["phone", "company-name", "company-domain"]';
