'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export type ObjectType = 'company' | 'contact' | 'deal';

export function useObjectType(): [ObjectType, (t: ObjectType) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const objectType = (searchParams.get('object') as ObjectType) ?? 'company';

  const setObjectType = useCallback((type: ObjectType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('object', type);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, searchParams, pathname]);

  return [objectType, setObjectType];
}
