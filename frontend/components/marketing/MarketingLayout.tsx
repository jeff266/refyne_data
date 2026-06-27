import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: F.sans, background: C.bg, color: C.text }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.sidebar }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 0,
              background: `linear-gradient(135deg, ${C.indigo}, #5a59e0)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 19,
              fontWeight: 700,
              fontFamily: F.serif,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(98,96,230,.45)',
            }}>
              R
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: F.serif, color: C.text, letterSpacing: '-.01em' }}>
              Refyne
            </span>
          </Link>

          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
            <Link href="/pricing" style={{ fontSize: 15, fontWeight: 500, color: C.text2, textDecoration: 'none' }}>
              Pricing
            </Link>
            <Link href="/sign-in" style={{ fontSize: 15, fontWeight: 500, color: C.text2, textDecoration: 'none' }}>
              Sign in
            </Link>
            <Link
              href="/sign-up"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                background: `linear-gradient(135deg, #7c7bff, #6260e6)`,
                padding: '11px 20px',
                borderRadius: 0,
                textDecoration: 'none',
                boxShadow: '0 6px 18px rgba(98,96,230,.4)',
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, background: C.sidebar, padding: '26px 48px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: Logo + Copyright */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 0,
                background: `linear-gradient(135deg, ${C.indigo}, #5a59e0)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: F.serif,
                color: '#fff',
                boxShadow: '0 2px 8px rgba(98,96,230,.35)',
              }}>
                R
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, fontFamily: F.serif, color: C.text, letterSpacing: '-.01em' }}>
                Refyne
              </span>
            </Link>
            <span style={{ fontSize: 13, color: C.text3, marginLeft: 8 }}>
              © 2026 RevOps Impact LLC
            </span>
          </div>

          {/* Right: Footer links */}
          <div style={{ display: 'flex', gap: 26 }}>
            <Link href="/pricing" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>
              Pricing
            </Link>
            <Link href="/privacy" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>
              Privacy
            </Link>
            <Link href="/security" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>
              Security
            </Link>
            <Link href="/terms" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>
              Terms
            </Link>
            <Link href="/support" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
