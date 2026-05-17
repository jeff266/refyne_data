'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import { NormalizationProvider } from '@/lib/settings';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

// Routes that should render without the standard header/sidebar
const fullscreenRoutes = ['/admin'];

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();

  // Check if current route should be rendered without header/sidebar
  const isFullscreenRoute = fullscreenRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isFullscreenRoute) {
    return (
      <NormalizationProvider>
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </NormalizationProvider>
    );
  }

  return (
    <NormalizationProvider>
      <div className="min-h-screen bg-mplc-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
        </div>
      </div>
    </NormalizationProvider>
  );
}
