import { Sidebar, TopBar } from '@/components/refyne';
import { TrialBanner } from '@/components/billing/TrialBanner';
import { RecordLimitBanner } from '@/components/billing/RecordLimitBanner';
import { OrgUrlCleanup } from '@/components/OrgUrlCleanup';
import { EnrichRunProvider } from '@/context/EnrichRunContext';
import { AssistantWidget } from '@/components/AssistantWidget';
import { C, F } from '@/lib/design-tokens';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EnrichRunProvider>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: C.bg,
          fontFamily: F.sans,
          overflow: 'hidden',
        }}
      >
        <OrgUrlCleanup />
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
          <RecordLimitBanner />
          <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
        </div>
        <AssistantWidget />
      </div>
    </EnrichRunProvider>
  );
}
