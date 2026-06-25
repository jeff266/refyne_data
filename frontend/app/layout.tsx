import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { CleanUrl } from '@/components/CleanUrl';
import { CookieBanner } from '@/components/CookieBanner';
import { Lora, Jost } from 'next/font/google';
import './globals.css';

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-lora',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Refyne',
  description: 'Data layer for revenue operations',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lora.variable} ${jost.variable}`}>
      <body>
        <ClerkProvider
          signUpFallbackRedirectUrl="/onboarding"
          signInFallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorBackground: '#162944',
              colorInputBackground: '#1a3352',
              colorText: '#F9F8F5',
              colorTextSecondary: '#94a3b8',
              colorPrimary: '#2E6BA8',
              colorDanger: '#ef4444',
              borderRadius: '0px',
              fontFamily: 'Jost, sans-serif',
            },
            elements: {
              card: {
                borderRadius: 0,
                backgroundColor: '#162944',
                border: '1px solid rgba(46,107,168,0.3)',
                boxShadow: 'none',
              },
              modalContent: { borderRadius: 0 },
              modalCloseButton: { color: '#F9F8F5' },
              formButtonPrimary: {
                borderRadius: 0,
                backgroundColor: '#2E6BA8',
                color: '#F9F8F5',
              },
              formFieldInput: {
                borderRadius: 0,
                backgroundColor: '#1a3352',
                border: '1px solid rgba(46,107,168,0.4)',
                color: '#F9F8F5',
              },
              organizationSwitcherPopoverCard: { borderRadius: 0 },
              organizationPreviewAvatarBox: { borderRadius: 0 },
            },
          }}
        >
          <CleanUrl />
          {children}
          <CookieBanner />
        </ClerkProvider>
      </body>
    </html>
  );
}
