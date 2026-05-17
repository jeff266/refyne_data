'use client';

import { ExternalLink } from 'lucide-react';

interface ProviderAttributionProps {
  providers: string[];
}

// Attribution requirements by provider
const attributionConfig: Record<string, {
  required: boolean;
  logo?: string;
  logoAlt?: string;
  text: string;
  link: string;
  linkText?: string;
  bgColor: string;
  textColor: string;
}> = {
  serper: {
    required: true,
    logo: '/attribution/google-maps.svg',
    logoAlt: 'Google Maps',
    text: 'Local business data from',
    link: 'https://maps.google.com',
    linkText: 'Google Maps',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  yelp: {
    required: true,
    logo: '/attribution/yelp.svg',
    logoAlt: 'Yelp',
    text: 'Business information and reviews from',
    link: 'https://www.yelp.com',
    linkText: 'Yelp',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  apollo: {
    required: false,
    text: 'Company data enriched via Apollo.io',
    link: 'https://www.apollo.io',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
  zoominfo: {
    required: false,
    text: 'Contact data enriched via ZoomInfo',
    link: 'https://www.zoominfo.com',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
  },
  clearbit: {
    required: true,
    logo: '/attribution/clearbit.svg',
    logoAlt: 'Clearbit',
    text: 'Company data from',
    link: 'https://clearbit.com',
    linkText: 'Clearbit',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
  },
  hunter: {
    required: false,
    text: 'Email data via Hunter.io',
    link: 'https://hunter.io',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  },
  lusha: {
    required: false,
    text: 'Contact data via Lusha',
    link: 'https://www.lusha.com',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
  },
  pdl: {
    required: false,
    text: 'Data enriched via People Data Labs',
    link: 'https://www.peopledatalabs.com',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
  builtwith: {
    required: false,
    text: 'Technology data via BuiltWith',
    link: 'https://builtwith.com',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  graphiq: {
    required: false,
    text: 'AI-powered search via GraphiqAI',
    link: '#',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  clay: {
    required: false,
    text: 'AI enrichment via Clay',
    link: 'https://www.clay.com',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  },
};

// Providers that REQUIRE attribution (strict ToS)
const REQUIRED_ATTRIBUTION = ['serper', 'yelp', 'clearbit'];

export default function ProviderAttribution({ providers }: ProviderAttributionProps) {
  // Only show attribution for providers that require it or are in the list
  const uniqueProviders = Array.from(new Set(providers));

  // Always show required attributions, optionally show others
  const providersToShow = uniqueProviders.filter(
    (p) => attributionConfig[p] && (REQUIRED_ATTRIBUTION.includes(p) || attributionConfig[p].required)
  );

  if (providersToShow.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <div className="flex flex-wrap items-center gap-3">
        {providersToShow.map((providerId) => {
          const config = attributionConfig[providerId];
          if (!config) return null;

          return (
            <a
              key={providerId}
              href={config.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${config.bgColor} ${config.textColor} hover:opacity-80 transition-opacity`}
            >
              {config.logo ? (
                <>
                  <img
                    src={config.logo}
                    alt={config.logoAlt || providerId}
                    className="h-4 w-auto"
                    onError={(e) => {
                      // Hide image if it fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span>
                    {config.text} {config.linkText}
                  </span>
                </>
              ) : (
                <span>{config.text}</span>
              )}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          );
        })}
      </div>

      {/* Fine print for strict requirements */}
      {providersToShow.includes('yelp') && (
        <p className="mt-2 text-[10px] text-gray-400">
          Yelp ratings and reviews are provided by Yelp Inc. Star ratings reflect the aggregate of user reviews.
        </p>
      )}
    </div>
  );
}

// Export for use in determining which providers need attribution
export function getRequiredAttributions(providers: string[]): string[] {
  return providers.filter((p) => REQUIRED_ATTRIBUTION.includes(p));
}
