'use client';

import { FlaskConical, AlertTriangle } from 'lucide-react';

interface SandboxBannerProps {
  enabled: boolean;
  resultCount: number;
}

export default function SandboxBanner({ enabled, resultCount }: SandboxBannerProps) {
  if (!enabled) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mb-4">
      <div className="flex items-center">
        <FlaskConical className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="ml-3">
          <p className="text-sm font-medium text-amber-800">
            Sandbox Mode Active
          </p>
          <p className="text-sm text-amber-700">
            {resultCount > 0
              ? `Showing ${resultCount} sample results for testing purposes`
              : 'Results limited to 3 samples when you search'
            }
          </p>
        </div>
        <div className="ml-auto pl-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Test Data
          </span>
        </div>
      </div>
    </div>
  );
}
