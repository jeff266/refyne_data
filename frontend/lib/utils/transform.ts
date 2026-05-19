/**
 * Transforms snake_case strings to camelCase
 */
export function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Transforms all keys in an object from snake_case to camelCase
 * Useful for converting Supabase query results to match TypeScript interfaces
 */
export function transformKeys<T>(obj: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v])
  ) as T;
}

/**
 * Transforms an array of objects from snake_case to camelCase
 */
export function transformArray<T>(arr: Array<Record<string, unknown>>): T[] {
  return arr.map(obj => transformKeys<T>(obj));
}
