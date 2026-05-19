'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Removes __clerk_org URL parameter after organization activation
 *
 * When switching organizations, Clerk appends ?__clerk_org=org_xxx to the URL.
 * This component removes it after a short delay to keep URLs clean.
 */
export function OrgUrlCleanup() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const clerkOrgParam = searchParams.get('__clerk_org');

    if (clerkOrgParam) {
      // Wait briefly for Clerk to process the org switch
      const timer = setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('__clerk_org');
        window.history.replaceState({}, '', url.toString());
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return null;
}
