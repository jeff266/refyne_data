import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/privacy',
  '/terms',
  '/docs',
  '/unsubscribed',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)', // Users need to access onboarding before they have an org
  '/api/webhooks(.*)', // Webhooks use signature validation, not session cookies
]);

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    await auth().protect();

    // After auth check, if user has no active org, activate their first org
    const { userId, orgId } = await auth();
    const url = new URL(request.url);

    // Only redirect if we haven't already tried to set the org (prevent redirect loop)
    if (userId && !orgId && !url.searchParams.has('__clerk_org')) {
      try {
        const client = await clerkClient();
        const userMemberships = await client.users.getOrganizationMembershipList({ userId });

        if (userMemberships.data.length > 0) {
          const firstOrg = userMemberships.data[0].organization;
          url.searchParams.set('__clerk_org', firstOrg.id);
          return NextResponse.redirect(url);
        }
      } catch (error) {
        // Clerk API error - log and continue without org activation
        console.error('[Middleware] Clerk API error:', error);
        // Continue to page without redirecting
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
