/**
 * Supabase Client
 *
 * Configures and exports the Supabase client for database operations.
 *
 * Supports both:
 * - Frontend: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - Backend/Worker: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Try backend env vars first (worker), then frontend env vars (Next.js app)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.warn('SUPABASE_URL is not set. Database features will be disabled.');
}

if (!supabaseKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Database features will be disabled.');
}

/**
 * Supabase client instance.
 * Returns null if environment variables are not configured.
 *
 * Uses service role key if available (full permissions for backend),
 * otherwise uses anon key (RLS-protected for frontend).
 */
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * Check if Supabase is configured and available.
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
