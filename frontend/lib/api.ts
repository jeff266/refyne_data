import type {
  Segment,
  Provider,
  SearchFilters,
  SearchResponse,
  ApiResponse,
  PaginatedResponse,
  DashboardStats,
} from '@/types';

// API Base URL - configurable via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// Segments API
// ============================================

export async function getSegments(): Promise<ApiResponse<Segment[]>> {
  return fetchApi<Segment[]>('/api/segments');
}

export async function getSegment(id: string): Promise<ApiResponse<Segment>> {
  return fetchApi<Segment>(`/api/segments/${id}`);
}

export async function createSegment(
  segment: Omit<Segment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApiResponse<Segment>> {
  return fetchApi<Segment>('/api/segments', {
    method: 'POST',
    body: JSON.stringify(segment),
  });
}

export async function updateSegment(
  id: string,
  segment: Partial<Segment>
): Promise<ApiResponse<Segment>> {
  return fetchApi<Segment>(`/api/segments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(segment),
  });
}

export async function deleteSegment(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/api/segments/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderProviders(
  segmentId: string,
  providerOrder: string[]
): Promise<ApiResponse<Segment>> {
  return fetchApi<Segment>(`/api/segments/${segmentId}/providers/reorder`, {
    method: 'POST',
    body: JSON.stringify({ order: providerOrder }),
  });
}

// ============================================
// Providers API
// ============================================

export async function getProviders(): Promise<ApiResponse<Provider[]>> {
  return fetchApi<Provider[]>('/api/providers');
}

export async function getProvider(id: string): Promise<ApiResponse<Provider>> {
  return fetchApi<Provider>(`/api/providers/${id}`);
}

export async function testProviderConnection(
  id: string
): Promise<ApiResponse<{ connected: boolean; latency: number }>> {
  return fetchApi<{ connected: boolean; latency: number }>(
    `/api/providers/${id}/test`
  );
}

export async function updateProviderConfig(
  id: string,
  config: Partial<Provider>
): Promise<ApiResponse<Provider>> {
  return fetchApi<Provider>(`/api/providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

// ============================================
// Search API
// ============================================

export async function searchProspects(
  filters: SearchFilters,
  options?: {
    page?: number;
    pageSize?: number;
    segmentId?: string;
  }
): Promise<ApiResponse<SearchResponse>> {
  const params = new URLSearchParams();

  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('page_size', String(options.pageSize));
  if (options?.segmentId) params.set('segment_id', options.segmentId);

  return fetchApi<SearchResponse>(`/api/search?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

export async function enrichContact(
  contactId: string,
  providerId?: string
): Promise<ApiResponse<SearchResult>> {
  const params = providerId ? `?provider_id=${providerId}` : '';
  return fetchApi<SearchResult>(`/api/enrich/${contactId}${params}`, {
    method: 'POST',
  });
}

// ============================================
// Dashboard API
// ============================================

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  return fetchApi<DashboardStats>('/api/dashboard/stats');
}

// ============================================
// Health Check
// ============================================

export async function healthCheck(): Promise<ApiResponse<{ status: string; version: string }>> {
  return fetchApi<{ status: string; version: string }>('/health');
}

// Type import for SearchResult
import type { SearchResult } from '@/types';
