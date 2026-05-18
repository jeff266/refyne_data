import { Sidebar, TopBar } from '@/components/refyne';
import { TrialBanner } from '@/components/billing/TrialBanner';
import { C, F } from '@/lib/design-tokens';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: C.bg,
        fontFamily: F.sans,
        overflow: 'hidden',
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TopBar />
        <TrialBanner />
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
