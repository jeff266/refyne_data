'use client';

import type { CapabilityType } from '@/lib/providers';

interface CapabilityBadgeProps {
  capability: CapabilityType;
  size?: 'sm' | 'md';
}

const capabilityStyles: Record<string, string> = {
  // Data types
  'Companies': 'bg-purple-50 text-purple-700 border-purple-200',
  'Contacts': 'bg-blue-50 text-blue-700 border-blue-200',
  'Firmographics': 'bg-indigo-50 text-indigo-700 border-indigo-200',

  // Local search
  'Local Businesses': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Ratings': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Contact Info': 'bg-cyan-50 text-cyan-700 border-cyan-200',

  // Advanced data
  'Technographics': 'bg-orange-50 text-orange-700 border-orange-200',
  'Intent': 'bg-rose-50 text-rose-700 border-rose-200',

  // AI & enrichment
  'AI Briefs': 'bg-violet-50 text-violet-700 border-violet-200',
  'Email Verification': 'bg-teal-50 text-teal-700 border-teal-200',
  'Phone Numbers': 'bg-sky-50 text-sky-700 border-sky-200',
  'Social Profiles': 'bg-pink-50 text-pink-700 border-pink-200',

  // Technical
  'Web Scraping': 'bg-slate-50 text-slate-700 border-slate-200',
  'Data Orchestration': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
};

export default function CapabilityBadge({ capability, size = 'sm' }: CapabilityBadgeProps) {
  const style = capabilityStyles[capability] || 'bg-mplc-gray-50 text-mplc-gray-700 border-mplc-gray-200';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${style} ${sizeClasses}`}
    >
      {capability}
    </span>
  );
}

export function CapabilityBadgeList({
  capabilities,
  max = 5,
  size = 'sm',
}: {
  capabilities: CapabilityType[];
  max?: number;
  size?: 'sm' | 'md';
}) {
  const visible = capabilities.slice(0, max);
  const remaining = capabilities.length - max;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((cap) => (
        <CapabilityBadge key={cap} capability={cap} size={size} />
      ))}
      {remaining > 0 && (
        <span className={`inline-flex items-center font-medium rounded bg-mplc-gray-100 text-mplc-gray-500 ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
        }`}>
          +{remaining} more
        </span>
      )}
    </div>
  );
}
