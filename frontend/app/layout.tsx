import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { CleanUrl } from '@/components/CleanUrl';
import './globals.css';

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
    <html lang="en">
      <body>
        <ClerkProvider
          signUpFallbackRedirectUrl="/onboarding"
          signInFallbackRedirectUrl="/dashboard"
        >
          <CleanUrl />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
