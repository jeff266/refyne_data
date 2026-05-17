'use client';

interface ProviderLogoProps {
  providerId: string;
  size?: number;
  className?: string;
}

export default function ProviderLogo({ providerId, size = 24, className = '' }: ProviderLogoProps) {
  const logos: Record<string, React.ReactNode> = {
    serper: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#4285F4"/>
        <circle cx="14" cy="14" r="6" stroke="white" strokeWidth="2.5" fill="none"/>
        <path d="M18.5 18.5L23 23" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),

    apollo: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#5856D6"/>
        <path d="M16 6L24 24H8L16 6Z" fill="white"/>
        <path d="M16 12L20 22H12L16 12Z" fill="#5856D6"/>
      </svg>
    ),

    zoominfo: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#FF6B35"/>
        <text x="16" y="21" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="system-ui">Zi</text>
      </svg>
    ),

    graphiq: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#10B981"/>
        <circle cx="11" cy="16" r="3" fill="white"/>
        <circle cx="21" cy="11" r="3" fill="white"/>
        <circle cx="21" cy="21" r="3" fill="white"/>
        <path d="M14 16L18 12M14 16L18 20" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),

    clay: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#F97316"/>
        <path d="M10 12C10 10.8954 10.8954 10 12 10H20C21.1046 10 22 10.8954 22 12V16C22 18.2091 20.2091 20 18 20H14C11.7909 20 10 18.2091 10 16V12Z" fill="white"/>
        <circle cx="14" cy="14" r="1.5" fill="#F97316"/>
        <circle cx="18" cy="14" r="1.5" fill="#F97316"/>
        <path d="M14 17.5C14 17.5 15 18.5 16 18.5C17 18.5 18 17.5 18 17.5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),

    yelp: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#D32323"/>
        <path d="M14 8V15L10 12V8H14Z" fill="white"/>
        <path d="M14 17L10 20V24L14 21V17Z" fill="white"/>
        <path d="M16 16L22 14V10L16 12V16Z" fill="white"/>
        <path d="M16 18L22 20V24L16 22V18Z" fill="white"/>
        <circle cx="15" cy="17" r="2" fill="white"/>
      </svg>
    ),

    clearbit: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#3B82F6"/>
        <rect x="8" y="8" width="7" height="7" rx="1" fill="white"/>
        <rect x="17" y="8" width="7" height="7" rx="1" fill="white" fillOpacity="0.6"/>
        <rect x="8" y="17" width="7" height="7" rx="1" fill="white" fillOpacity="0.6"/>
        <rect x="17" y="17" width="7" height="7" rx="1" fill="white"/>
      </svg>
    ),

    hunter: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#FF5722"/>
        <circle cx="16" cy="13" r="5" fill="white"/>
        <path d="M8 26C8 21.5817 11.5817 18 16 18C20.4183 18 24 21.5817 24 26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),

    pdl: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#1E3A5F"/>
        <text x="16" y="20" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui">PDL</text>
      </svg>
    ),

    builtwith: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#2563EB"/>
        <rect x="8" y="18" width="4" height="6" fill="white"/>
        <rect x="14" y="14" width="4" height="10" fill="white"/>
        <rect x="20" y="10" width="4" height="14" fill="white"/>
      </svg>
    ),

    lusha: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
        <rect width="32" height="32" rx="6" fill="#6366F1"/>
        <path d="M16 8L22 16L16 24L10 16L16 8Z" fill="white"/>
      </svg>
    ),
  };

  // Default logo for unknown providers
  const defaultLogo = (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size} className={className}>
      <rect width="32" height="32" rx="6" fill="#6B7280"/>
      <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="16" cy="16" r="3" fill="white"/>
    </svg>
  );

  return <>{logos[providerId] || defaultLogo}</>;
}

// Export provider colors for use elsewhere
export const PROVIDER_COLORS: Record<string, string> = {
  serper: '#4285F4',
  apollo: '#5856D6',
  zoominfo: '#FF6B35',
  graphiq: '#10B981',
  clay: '#F97316',
  yelp: '#D32323',
  clearbit: '#3B82F6',
  hunter: '#FF5722',
  pdl: '#1E3A5F',
  builtwith: '#2563EB',
  lusha: '#6366F1',
};
