import { useOrganization } from '@clerk/nextjs';
import { isAdmin, isMember, type OrgRole } from '@/lib/auth/roles';

export function useRole() {
  const { membership } = useOrganization();
  const orgRole = membership?.role as OrgRole;

  return {
    isAdmin: isAdmin(orgRole),
    isMember: isMember(orgRole),
    orgRole,
  };
}
