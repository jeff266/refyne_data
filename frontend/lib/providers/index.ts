/**
 * Provider Adapters Index
 *
 * Exports all provider adapters and the provider registry.
 */

// Types
export * from './types';

// Individual Adapters
export { SerperAdapter } from './serper';
export { ApolloAdapter } from './apollo';
export { ZoomInfoAdapter, clearTokenCache as clearZoomInfoTokenCache } from './zoominfo';
export { ClayAdapter, checkClaygentStatus } from './clay';
export { GraphiqAdapter } from './graphiq';
export { YelpAdapter } from './yelp';

// Import for registry
import { ProviderAdapter } from './types';
import { SerperAdapter } from './serper';
import { ApolloAdapter } from './apollo';
import { ZoomInfoAdapter } from './zoominfo';
import { ClayAdapter } from './clay';
import { GraphiqAdapter } from './graphiq';
import { YelpAdapter } from './yelp';

// ─────────────────────────────────────────────────────────────
// Provider Registry
// ─────────────────────────────────────────────────────────────

/**
 * Registry of all available provider adapters.
 * Use getProvider() or getProviderRegistry() to access.
 */
const PROVIDER_REGISTRY: Record<string, ProviderAdapter> = {
  serper: new SerperAdapter(),
  apollo: new ApolloAdapter(),
  zoominfo: new ZoomInfoAdapter(),
  clay: new ClayAdapter(),
  graphiq: new GraphiqAdapter(),
  yelp: new YelpAdapter(),
};

/**
 * Get a provider adapter by ID.
 */
export function getProvider(id: string): ProviderAdapter | undefined {
  return PROVIDER_REGISTRY[id];
}

/**
 * Get all provider IDs.
 */
export function getProviderIds(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

/**
 * Get the full provider registry.
 */
export function getProviderRegistry(): Record<string, ProviderAdapter> {
  return PROVIDER_REGISTRY;
}

/**
 * Check if a provider is registered.
 */
export function hasProvider(id: string): boolean {
  return id in PROVIDER_REGISTRY;
}

/**
 * Register a new provider adapter at runtime.
 */
export function registerProvider(adapter: ProviderAdapter): void {
  PROVIDER_REGISTRY[adapter.id] = adapter;
}

// Default export
export default PROVIDER_REGISTRY;
