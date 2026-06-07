// Canonical RBAC definitions for Refyne
// Conservative beta model: members read/preview, admins write/configure

export type OrgRole = 'org:admin' | 'org:member' | undefined;

// Actions members CAN perform
export const MEMBER_PERMITTED = [
  'normalize:preview',
  'dedup:scan',
  'dedup:view',
  'dedup:reject',        // reject only, not merge
  'enrich:preview',
  'history:view',
  'harmony:view',
  'harmony:test',
  'compliance:view',
  'billing:view',
  'segmentation:view',
] as const;

// Actions requiring admin
export const ADMIN_ONLY = [
  'normalize:apply',
  'dedup:merge',
  'dedup:configure',
  'dedup:auto-merge-settings',
  'enrich:apply',
  'harmony:create',
  'harmony:edit',
  'harmony:delete',
  'harmony:toggle',
  'arrangement:create',
  'arrangement:edit',
  'arrangement:delete',
  'connection:create',
  'connection:delete',
  'billing:manage',
  'billing:upgrade',
  'team:invite',
  'team:remove',
  'always-on:configure',
  'import:yaml',
  'segmentation:run',
  'segmentation:configure',
  'policies:configure',
] as const;

export function requireAdmin(orgRole: OrgRole): void {
  if (orgRole !== 'org:admin') {
    throw new Response(
      JSON.stringify({ error: 'admin_required', message: 'This action requires admin access' }),
      { status: 403 }
    );
  }
}

export function isAdmin(orgRole: OrgRole): boolean {
  return orgRole === 'org:admin';
}

export function isMember(orgRole: OrgRole): boolean {
  return orgRole === 'org:member' || orgRole === 'org:admin';
}
