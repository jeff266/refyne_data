import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: F.sans, background: C.bg, color: C.text }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.sidebar }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 600, color: C.text, textDecoration: 'none' }}>
            Refyne
          </Link>
          <Link
            href="/sign-in"
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: C.text,
              textDecoration: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              transition: 'all 0.2s',
            }}
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, background: C.sidebar, padding: '24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 24, fontSize: 13, color: C.text2 }}>
          <span>© 2026 Refyne</span>
          <span>·</span>
          <Link href="/privacy" style={{ color: C.text2, textDecoration: 'none' }}>Privacy</Link>
          <span>·</span>
          <Link href="/security" style={{ color: C.text2, textDecoration: 'none' }}>Security</Link>
          <span>·</span>
          <Link href="/terms" style={{ color: C.text2, textDecoration: 'none' }}>Terms</Link>
          <span>·</span>
          <a href="mailto:jeff@revopsimpact.us" style={{ color: C.text2, textDecoration: 'none' }}>Support</a>
        </div>
      </footer>
    </div>
  );
}
