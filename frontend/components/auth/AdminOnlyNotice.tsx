import { C } from '@/lib/design-tokens';

interface AdminOnlyNoticeProps {
  action: string;
}

/**
 * Shown inline where admin-only actions are hidden.
 * Subdued text, no icon, no border - just a single line.
 *
 * Usage: <AdminOnlyNotice action="apply normalizations" />
 * Renders: "Contact your workspace admin to apply normalizations"
 */
export function AdminOnlyNotice({ action }: AdminOnlyNoticeProps) {
  return (
    <div style={{
      fontSize: 12,
      color: C.text3,
      padding: '8px 0',
    }}>
      Contact your workspace admin to {action}
    </div>
  );
}
