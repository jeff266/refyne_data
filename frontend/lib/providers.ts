import {
  MapPin,
  Users,
  Database,
  BarChart3,
  Layers,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

export type ProviderTypeCategory = 'local_search' | 'enrichment' | 'ai_enrichment';

export type CapabilityType =
  | 'Local Businesses'
  | 'Ratings'
  | 'Contact Info'
  | 'Companies'
  | 'Contacts'
  | 'Technographics'
  | 'Intent'
  | 'AI Briefs'
  | 'Firmographics'
  | 'Email Verification'
  | 'Phone Numbers'
  | 'Social Profiles'
  | 'Web Scraping'
  | 'Data Orchestration';

export interface ProviderMeta {
  id: string;
  name: string;
  type: ProviderTypeCategory;
  icon: LucideIcon;
  description: string;
  longDescription?: string;
  capabilities: CapabilityType[];
  docsUrl: string;
  envKeys: string[];
  rateLimitPerMinute?: number;
  costPerCall?: number;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  serper: {
    id: 'serper',
    name: 'Serper',
    type: 'local_search',
    icon: MapPin,
    description: 'Google Maps data for local businesses',
    longDescription:
      'Serper provides access to Google Search and Maps APIs, enabling retrieval of local business information including ratings, reviews, contact details, and business hours. Ideal for local lead generation and business discovery.',
    capabilities: ['Local Businesses', 'Ratings', 'Contact Info'],
    docsUrl: 'https://serper.dev/docs',
    envKeys: ['SERPER_API_KEY'],
    rateLimitPerMinute: 100,
    costPerCall: 0.001,
  },
  apollo: {
    id: 'apollo',
    name: 'Apollo',
    type: 'enrichment',
    icon: Users,
    description: 'B2B contact and company data enrichment',
    longDescription:
      'Apollo is a comprehensive B2B sales intelligence platform providing access to over 250M contacts and 60M companies. Get verified emails, phone numbers, job titles, and company firmographics for your outbound campaigns.',
    capabilities: ['Contacts', 'Companies', 'Email Verification', 'Phone Numbers', 'Firmographics'],
    docsUrl: 'https://apolloio.github.io/apollo-api-docs/',
    envKeys: ['APOLLO_API_KEY'],
    rateLimitPerMinute: 60,
    costPerCall: 0.03,
  },
  zoominfo: {
    id: 'zoominfo',
    name: 'ZoomInfo',
    type: 'enrichment',
    icon: Database,
    description: 'Enterprise B2B intelligence platform',
    longDescription:
      'ZoomInfo is the leading enterprise B2B data provider with comprehensive company and contact information, intent data, and technographic insights. Best suited for enterprise sales and marketing teams.',
    capabilities: ['Contacts', 'Companies', 'Technographics', 'Intent', 'Firmographics'],
    docsUrl: 'https://www.zoominfo.com/solutions/integrations',
    envKeys: ['ZOOMINFO_API_KEY', 'ZOOMINFO_CLIENT_ID'],
    rateLimitPerMinute: 200,
    costPerCall: 0.10,
  },
  graphiq: {
    id: 'graphiq',
    name: 'GraphIQ',
    type: 'ai_enrichment',
    icon: BarChart3,
    description: 'AI-powered knowledge graph and entity enrichment',
    longDescription:
      'GraphIQ uses advanced AI and knowledge graphs to enrich your data with deep insights, entity relationships, and contextual information. Perfect for complex account research and relationship mapping.',
    capabilities: ['Companies', 'AI Briefs', 'Firmographics', 'Social Profiles'],
    docsUrl: 'https://graphiq.io/docs',
    envKeys: ['GRAPHIQ_API_KEY'],
    rateLimitPerMinute: 30,
    costPerCall: 0.05,
  },
  clay: {
    id: 'clay',
    name: 'Clay',
    type: 'ai_enrichment',
    icon: Layers,
    description: 'Data enrichment and outbound automation',
    longDescription:
      'Clay is a powerful data orchestration platform that combines 50+ data providers with AI capabilities. Build complex enrichment workflows, automate outbound, and leverage AI for personalized briefs.',
    capabilities: ['Companies', 'Contacts', 'AI Briefs', 'Web Scraping', 'Data Orchestration'],
    docsUrl: 'https://docs.clay.com/',
    envKeys: ['CLAY_API_KEY'],
    rateLimitPerMinute: 50,
    costPerCall: 0.02,
  },
};

export const PROVIDER_LIST = Object.values(PROVIDER_META);

export const getProviderById = (id: string): ProviderMeta | undefined => {
  return PROVIDER_META[id];
};

export const getProvidersByType = (type: ProviderTypeCategory): ProviderMeta[] => {
  return PROVIDER_LIST.filter((p) => p.type === type);
};

export const getProviderTypeLabel = (type: ProviderTypeCategory): string => {
  const labels: Record<ProviderTypeCategory, string> = {
    local_search: 'Local Search',
    enrichment: 'Enrichment',
    ai_enrichment: 'AI Enrichment',
  };
  return labels[type];
};

export const getProviderTypeColor = (type: ProviderTypeCategory): string => {
  const colors: Record<ProviderTypeCategory, string> = {
    local_search: 'bg-blue-50 text-blue-700 border-blue-200',
    enrichment: 'bg-purple-50 text-purple-700 border-purple-200',
    ai_enrichment: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return colors[type];
};
