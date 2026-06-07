import { useOrganization } from '@clerk/nextjs';
import { isAdmin, isMember } from '@/lib/auth/roles';
import type { OrgRole } from '@/lib/auth/clerk-helpers';

export function useRole() {
  const { membership } = useOrganization();
  const orgRole = membership?.role as OrgRole;

  return {
    isAdmin: isAdmin(orgRole),
    isMember: isMember(orgRole),
    orgRole,
  };
}
