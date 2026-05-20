'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Strips __clerk_org parameter from URL after Clerk hydration.
 * Prevents internal org IDs from leaking in the address bar.
 */
export function CleanUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.has('__clerk_org')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('__clerk_org');
      const newUrl = params.size > 0 ? `${pathname}?${params}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, pathname, router]);

  return null;
}
