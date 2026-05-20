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
    <ClerkProvider
      afterSignUpUrl="/onboarding"
      fallbackRedirectUrl="/dashboard"
    >
      <html lang="en">
        <body>
          <CleanUrl />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
