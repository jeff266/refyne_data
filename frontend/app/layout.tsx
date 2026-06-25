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
              formFieldLabel: {
                color: '#F9F8F5',
              },
              formFieldAction: {
                color: '#F9F8F5',
              },
              avatarImageActions: {
                color: '#F9F8F5',
              },
              avatarImageActionsUpload: {
                color: '#F9F8F5',
              },
              // Org switcher
              organizationSwitcherPopoverCard: {
                borderRadius: 0,
                backgroundColor: '#162944',
              },
              organizationPreviewAvatarBox: { borderRadius: 0 },
              organizationSwitcherPopoverActionButton: {
                color: '#F9F8F5',
              },
              organizationSwitcherPopoverActionButtonText: {
                color: '#F9F8F5',
              },
              organizationPreviewMainIdentifier: {
                color: '#F9F8F5',
              },
              organizationPreviewSecondaryIdentifier: {
                color: '#94a3b8',
              },
              // User button menu
              userButtonPopoverCard: {
                borderRadius: 0,
                backgroundColor: '#162944',
              },
              userButtonPopoverActionButton: {
                color: '#F9F8F5',
              },
              userButtonPopoverActionButtonText: {
                color: '#F9F8F5',
              },
              userButtonPopoverActionButtonIcon: {
                color: '#F9F8F5',
              },
              // Social login buttons
              socialButtonsBlockButton: {
                borderRadius: 0,
                backgroundColor: '#1a3352',
                border: '1px solid rgba(46,107,168,0.4)',
                color: '#F9F8F5',
              },
              socialButtonsBlockButtonText: {
                color: '#F9F8F5',
              },
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
