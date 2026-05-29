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
  // In development, skip auth PROTECTION but still process Clerk session
  // This allows getOrgContext() to work correctly in API routes
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    console.log('[Dev Mode] Skipping auth protection (session still processed)');
    // Don't call .protect() - allow unauthenticated access
    // But Clerk middleware still processes session cookies
  } else {
    // Production: require auth for non-public routes
    if (!isPublicRoute(request)) {
      await auth().protect();
    }
  }

  // Let Clerk middleware finish processing (this is important!)
  // Don't return early in development
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
