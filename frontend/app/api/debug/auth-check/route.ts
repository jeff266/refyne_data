import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';

/**
 * Diagnostic endpoint to check auth and Supabase configuration
 */
export async function GET() {
  try {
    // Check Clerk auth
    const authData = await auth();

    // Check Supabase config
    const supabaseConfig = {
      hasUrl: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      clientExists: !!supabase,
    };

    // Try a simple Supabase query
    let supabaseTest = null;
    if (supabase && authData.orgId) {
      const { data, error } = await supabase
        .from('hubspot_connections')
        .select('id, org_id, portal_id, connection_status')
        .eq('org_id', authData.orgId)
        .limit(1);

      supabaseTest = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
        } : null,
        rowCount: data?.length || 0,
      };
    }

    return NextResponse.json({
      auth: {
        userId: authData.userId,
        orgId: authData.orgId,
        orgRole: authData.orgRole,
        hasSession: !!authData.userId,
      },
      supabase: supabaseConfig,
      supabaseQuery: supabaseTest,
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
