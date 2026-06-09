import { C, F } from '@/lib/design-tokens';

export const metadata = {
  title: 'Onboarding - Refyne',
  description: 'Get started with Refyne',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#162944', // Dark navy background
        fontFamily: F.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with logo */}
      <div
        style={{
          background: '#1E293B', // Navy header
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoLt})`,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            R
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Refyne
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
