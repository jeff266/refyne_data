/**
 * Supabase Admin Client
 *
 * Export a typed Supabase client with service role key for backend operations.
 * This is the same as the main supabase client when SUPABASE_SERVICE_ROLE_KEY is set.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase credentials for admin client. ' +
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
