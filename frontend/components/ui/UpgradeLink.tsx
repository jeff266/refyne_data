import { F, C } from '@/lib/design-tokens';

interface UpgradeLinkProps {
  reason: string;        // "merge records"
  targetPlan?: string;   // "Growth" (optional)
  href?: string;         // defaults to /settings/billing
}

export function UpgradeLink({
  reason,
  targetPlan,
  href = '/settings/billing'
}: UpgradeLinkProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontFamily: F.sans
      }}
      data-testid="upgrade-link"
    >
      <span style={{ color: C.text3 }}>
        {targetPlan
          ? `Requires ${targetPlan} plan`
          : 'Upgrade to unlock'}
      </span>
      <a
        href={href}
        style={{
          color: C.accent,
          textDecoration: 'none',
          fontWeight: 500
        }}
      >
        View plans →
      </a>
    </span>
  );
}
