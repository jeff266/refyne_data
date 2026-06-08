import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// DEVELOPMENT ONLY: Bypass auth for local testing
// DO NOT deploy this to production!

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/privacy',
  '/terms',
  '/docs',
  '/unsubscribed',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // In development, skip auth PROTECTION but still process Clerk session
  // This allows getOrgContext() to work correctly in API routes
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    console.log('[Dev Mode] Skipping auth protection (session still processed)');
    // Don't call .protect() - allow unauthenticated access
    // But Clerk middleware still processes session cookies
    return NextResponse.next();
  }

  // Production: require auth for non-public routes
  if (!isPublicRoute(request)) {
    await auth().protect();
  }

  // Onboarding redirect logic (runs after auth)
  const authData = await auth();
  const { orgRole, orgId } = authData;

  // Only check onboarding for admins
  const isAdmin = orgRole === 'org:admin';
  const isOnboardingRoute = pathname.startsWith('/onboarding');
  const isDashboardRoute = !isOnboardingRoute &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/sign-') &&
    !pathname.startsWith('/pricing') &&
    !pathname.startsWith('/privacy') &&
    !pathname.startsWith('/terms') &&
    !pathname.startsWith('/docs') &&
    !pathname.startsWith('/unsubscribed') &&
    pathname !== '/';

  if (isAdmin && orgId) {
    // Check cookie first (fast path)
    const onboardingCookie = request.cookies.get('refyne_onboarding_complete');
    const isOnboardingComplete = !!onboardingCookie;

    // Redirect to onboarding if not complete and trying to access dashboard
    if (!isOnboardingComplete && isDashboardRoute) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // Redirect to dashboard if already complete and trying to access onboarding
    if (isOnboardingComplete && isOnboardingRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
