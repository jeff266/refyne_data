import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { captureException } from '@sentry/nextjs';

/**
 * POST /api/onboarding/profile
 *
 * Creates org, sets metadata, initializes onboarding progress
 * Public (user is authenticated but may not have org yet)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { role, companySize, companyName } = body;

    // Validate input
    if (!role || !['revops', 'sales', 'marketing', 'agency'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    if (!companySize || !['under_5k', '5k_to_50k', 'over_50k'].includes(companySize)) {
      return NextResponse.json(
        { error: 'Invalid company size' },
        { status: 400 }
      );
    }

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Create Clerk organization
    const org = await client.organizations.createOrganization({
      name: companyName.trim(),
      createdBy: userId,
      publicMetadata: {
        user_role: role,
        company_size: companySize,
      },
    });

    // Set active organization
    await client.users.updateUser(userId, {
      publicMetadata: {
        active_org_id: org.id,
      },
    });

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Create workspace entitlements
    const { error: entitlementsError } = await supabase
      .from('workspace_entitlements')
      .insert({
        clerk_org_id: org.id,
        org_name: companyName.trim(),
        allow_operator_push: false,
        duplicate_push_policy: 'block',
        external_agencies_enabled: false,
      });

    if (entitlementsError) {
      console.error('Failed to create workspace entitlements:', entitlementsError);
      // Continue anyway - the org was created
    }

    // Create onboarding progress record
    const { error: onboardingError } = await supabase
      .from('onboarding_progress')
      .insert({
        clerk_org_id: org.id,
        user_role: role,
        company_size: companySize,
        workspace_name: companyName.trim(),
        signup_path: 'self',
        completed: false,
      });

    if (onboardingError) {
      console.error('Failed to create onboarding progress:', onboardingError);
      captureException(onboardingError);
    }

    return NextResponse.json({
      orgId: org.id,
      redirectTo: '/onboarding/connect',
    });
  } catch (error) {
    console.error('Failed to create organization:', error);
    captureException(error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
