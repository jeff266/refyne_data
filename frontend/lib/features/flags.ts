import { supabase } from '@/lib/db/supabase';

// Registry of all known flags
// Add new flags here when building new beta features
export const FEATURE_FLAGS = {
  BETA_FEATURES: 'beta_features',       // master opt-in toggle
  EVENT_LIST_IMPORT: 'event_list_import', // Event List Import feature
  CONTACT_DEDUP: 'contact_dedup',        // Contact dedup UI
  ALWAYS_ON: 'always_on',                // Always On overnight processing
} as const;

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

// Check if a flag is enabled for an org
// Checks staff_override first, then org self-serve
// Use this in API routes and server components
export async function isFeatureEnabled(
  orgId: string,
  flag: FeatureFlag
): Promise<boolean> {
  if (!supabase) return false;

  const { data } = await supabase
    .from('org_feature_flags')
    .select('enabled, staff_override')
    .eq('org_id', orgId)
    .eq('flag', flag)
    .single();

  if (!data) return false;

  // Staff override takes precedence
  if (data.staff_override) return true;

  return data.enabled;
}

// Check if beta_features master toggle is on
// AND the specific flag is enabled
export async function isBetaFeatureEnabled(
  orgId: string,
  flag: FeatureFlag
): Promise<boolean> {
  // master toggle must be on first
  const betaEnabled = await isFeatureEnabled(orgId, FEATURE_FLAGS.BETA_FEATURES);
  if (!betaEnabled) return false;

  return isFeatureEnabled(orgId, flag);
}

// Batch check multiple flags at once
// More efficient than multiple isFeatureEnabled calls
export async function getFeatureFlags(
  orgId: string,
  flags: FeatureFlag[]
): Promise<Record<FeatureFlag, boolean>> {
  if (!supabase) {
    // Return all false if DB not configured
    const result = {} as Record<FeatureFlag, boolean>;
    flags.forEach(f => result[f] = false);
    return result;
  }

  const { data } = await supabase
    .from('org_feature_flags')
    .select('flag, enabled, staff_override')
    .eq('org_id', orgId)
    .in('flag', flags);

  const result = {} as Record<FeatureFlag, boolean>;

  // Default all to false
  flags.forEach(f => result[f] = false);

  // Apply actual values
  data?.forEach(row => {
    result[row.flag as FeatureFlag] = row.staff_override || row.enabled;
  });

  return result;
}

// Enable a flag for an org (self-serve)
// Call from API route, not directly from component
export async function enableFlag(
  orgId: string,
  flag: FeatureFlag,
  enabledBy: string
): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('org_feature_flags')
    .upsert({
      org_id: orgId,
      flag,
      enabled: true,
      enabled_by: enabledBy,
      enabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id,flag' });
}

// Disable a flag for an org (self-serve)
export async function disableFlag(
  orgId: string,
  flag: FeatureFlag,
  disabledBy: string
): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('org_feature_flags')
    .upsert({
      org_id: orgId,
      flag,
      enabled: false,
      enabled_by: disabledBy,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id,flag' });
}

// Staff override - enable for specific org regardless of self-serve
// Only callable from admin panel routes (isRefyneStaff check)
export async function staffOverrideFlag(
  orgId: string,
  flag: FeatureFlag,
  staffUserId: string,
  note: string
): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('org_feature_flags')
    .upsert({
      org_id: orgId,
      flag,
      staff_override: true,
      staff_override_by: staffUserId,
      staff_override_at: new Date().toISOString(),
      staff_override_note: note,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id,flag' });
}
