'use client';

import { Search, Settings, Bell } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  showSearch?: boolean;
}

export default function Header({ showSearch = true }: HeaderProps) {
  return (
    <header className="bg-mplc-white border-b border-mplc-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3">
          <div className="relative px-3 py-1.5">
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-mplc-black" />
            <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-mplc-black" />
            <span className="font-semibold text-lg tracking-tight">MPLC</span>
          </div>
          <span className="text-mplc-gray-400 font-light">|</span>
          <span className="text-mplc-gray-600 text-sm">Enrichment Switcher</span>
        </Link>

        {/* Center - Search (optional) */}
        {showSearch && (
          <div className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-mplc-gray-400" />
              <input
                type="text"
                placeholder="Search prospects, companies, or segments..."
                className="input pl-10 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {/* Right side - Actions */}
        <div className="flex items-center space-x-4">
          <button className="p-2 text-mplc-gray-500 hover:text-mplc-black hover:bg-mplc-gray-100 rounded-md transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <Link
            href="/settings"
            className="p-2 text-mplc-gray-500 hover:text-mplc-black hover:bg-mplc-gray-100 rounded-md transition-colors"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-mplc-gray-200" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-mplc-black rounded-full flex items-center justify-center">
              <span className="text-mplc-white text-sm font-medium">JI</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
