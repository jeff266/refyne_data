// Enrichment Provider Types
export type ProviderType = 'apollo' | 'zoominfo' | 'clearbit' | 'lusha' | 'manual';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  description?: string;
  apiKeyConfigured: boolean;
  rateLimitPerMinute?: number;
  costPerCall?: number;
}

// Cascade/Waterfall Configuration Types
export type CascadeTrigger = 'always' | 'on_error' | 'on_empty' | 'on_missing_field' | 'on_field_present' | 'on_condition';

export interface CascadeProvider {
  id: string;
  trigger: CascadeTrigger;
  trigger_config: Record<string, any>;
  fields: string[];
  timeout_ms: number;
  retry_count: number;
}

export interface ProviderCascade {
  cascade: CascadeProvider[];
  field_priority: 'first_wins' | 'last_wins' | 'most_complete';
  dedup_key: string;
}

// Segment Types
export type SegmentStatus = 'active' | 'inactive' | 'draft';

export interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: string | number | string[];
}

export interface ProviderConfig {
  providerId: string;
  priority: number;
  enabled: boolean;
  fallbackOnly?: boolean;
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  status: SegmentStatus;
  criteria: SegmentCriteria[];
  providers: ProviderCascade;
  providerStack: ProviderConfig[];
  createdAt: string;
  updatedAt: string;
  matchCount?: number;
}

// Search Types
export interface SearchFilters {
  jobTitle?: string;
  company?: string;
  industry?: string;
  location?: string;
  employeeCountMin?: number;
  employeeCountMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  technologies?: string[];
  seniority?: string[];
}

export interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle: string;
  company: string;
  industry?: string;
  location?: string;
  linkedInUrl?: string;
  enrichedAt?: string;
  source: ProviderType;
  confidence: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  segmentMatched?: string;
  providerUsed: ProviderType;
  searchTime: number;
}

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Dashboard Stats
export interface DashboardStats {
  totalSearches: number;
  totalEnrichments: number;
  activeSegments: number;
  providerUsage: {
    provider: ProviderType;
    count: number;
    percentage: number;
  }[];
  recentActivity: {
    timestamp: string;
    action: string;
    details: string;
  }[];
}

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
}
