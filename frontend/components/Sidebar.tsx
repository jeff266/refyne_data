'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Layers,
  Database,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronRight,
  Shield,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'Prospect Search',
    href: '/search',
    icon: <Search className="w-5 h-5" />,
  },
  {
    label: 'Segments',
    href: '/segments',
    icon: <Layers className="w-5 h-5" />,
  },
  {
    label: 'Providers',
    href: '/providers',
    icon: <Database className="w-5 h-5" />,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: <BarChart3 className="w-5 h-5" />,
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: 'Admin',
    href: '/admin',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
  },
  {
    label: 'Help & Docs',
    href: '/help',
    icon: <HelpCircle className="w-5 h-5" />,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        className={`
          flex items-center justify-between px-3 py-2.5 rounded-md
          transition-colors duration-150 group
          ${
            active
              ? 'bg-mplc-black text-mplc-white'
              : 'text-mplc-gray-600 hover:bg-mplc-gray-100 hover:text-mplc-black'
          }
        `}
      >
        <div className="flex items-center space-x-3">
          <span className={active ? 'text-mplc-white' : 'text-mplc-gray-400 group-hover:text-mplc-gray-600'}>
            {item.icon}
          </span>
          <span className="font-medium text-sm">{item.label}</span>
        </div>
        {item.badge && (
          <span
            className={`
              px-2 py-0.5 text-xs font-medium rounded-full
              ${active ? 'bg-mplc-white/20 text-mplc-white' : 'bg-mplc-gray-100 text-mplc-gray-600'}
            `}
          >
            {item.badge}
          </span>
        )}
        {active && <ChevronRight className="w-4 h-4 opacity-60" />}
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-mplc-white border-r border-mplc-gray-200 h-[calc(100vh-4rem)] sticky top-16 flex flex-col">
      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-mplc-gray-200" />

      {/* Bottom Navigation */}
      <nav className="p-4 space-y-1">
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Version Info */}
      <div className="p-4 border-t border-mplc-gray-200">
        <div className="text-xs text-mplc-gray-400">
          <p>Enrichment Switcher</p>
          <p>v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
