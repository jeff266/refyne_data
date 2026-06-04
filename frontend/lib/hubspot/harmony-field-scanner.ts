/**
 * HubSpot Field Scanner for Harmony Wizard
 *
 * Scans a HubSpot field to find all distinct values and their counts.
 * Uses Export API for large portals with crm.export scope, otherwise uses
 * standard list endpoint for optimal performance.
 */

import { HubSpotClient } from './client';

interface ScanOptions {
  client: HubSpotClient;
  objectType: 'company' | 'contact';
  fieldName: string;
  hasExportScope?: boolean;
  onProgress?: (progress: number, totalRecords: number) => void;
}

interface DistinctValue {
  value: string;
  count: number;
}

export async function scanHubSpotField(options: ScanOptions): Promise<DistinctValue[]> {
  const { client, objectType, fieldName, hasExportScope = false, onProgress } = options;

  const startTime = Date.now();
  console.log(`[Harmony Scanner] Starting scan for field ${fieldName} on ${objectType}s`);

  // Value frequency map
  const valueMap = new Map<string, number>();
  let totalRecords = 0;
  let batchCount = 0;

  try {
    // For large portals with Export API access, use export method
    if (hasExportScope) {
      console.log(`[Harmony Scanner] Using Export API (has crm.export scope)`);

      const exportedRecords = await client.exportCompanies([fieldName]);

      if (exportedRecords) {
        // Process exported records
        for (const record of exportedRecords) {
          totalRecords++;
          const value = record.properties?.[fieldName];
          if (value && value.trim()) {
            const trimmedValue = value.trim();
            valueMap.set(trimmedValue, (valueMap.get(trimmedValue) || 0) + 1);
          }
        }

        if (onProgress) {
          onProgress(100, totalRecords);
        }

        console.log(`[Harmony Scanner] Export API: processed ${totalRecords} records`);
      } else {
        console.warn(`[Harmony Scanner] Export API failed, falling back to getAllRecords`);
        // Fall through to getAllRecords method below
        return scanViaGetAllRecords(client, objectType, fieldName, onProgress);
      }
    } else {
      // Use standard list endpoint with getAllRecords
      return scanViaGetAllRecords(client, objectType, fieldName, onProgress);
    }
  } catch (error) {
    console.error(`[Harmony Scanner] Scan failed:`, error);
    throw error;
  } finally {
    const elapsed = Date.now() - startTime;
    console.log(`[Harmony Scanner] Completed in ${elapsed}ms (${totalRecords} records, ${valueMap.size} distinct values)`);
  }

  // Convert map to sorted array
  const distinctValues: DistinctValue[] = Array.from(valueMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count); // Sort by frequency descending

  return distinctValues;
}

/**
 * Scan using standard getAllRecords method.
 * Faster than Search API, no artificial delays.
 */
async function scanViaGetAllRecords(
  client: HubSpotClient,
  objectType: 'company' | 'contact',
  fieldName: string,
  onProgress?: (progress: number, totalRecords: number) => void
): Promise<DistinctValue[]> {
  console.log(`[Harmony Scanner] Using getAllRecords (standard list endpoint)`);

  const valueMap = new Map<string, number>();
  let totalRecords = 0;
  let batchCount = 0;

  // Use client.getAllRecords which uses standard list endpoint
  for await (const batch of client.getAllRecords(objectType, [fieldName])) {
    batchCount++;

    // Aggregate values from batch
    for (const record of batch) {
      totalRecords++;
      const value = record.properties?.[fieldName];
      if (value && value.trim()) {
        const trimmedValue = value.trim();
        valueMap.set(trimmedValue, (valueMap.get(trimmedValue) || 0) + 1);
      }
    }

    // Report progress (estimate 50% until we know we're done)
    if (onProgress) {
      const progress = batchCount === 1 ? 50 : 75; // Will update to 100 at end
      onProgress(progress, totalRecords);
    }

    if (batchCount % 10 === 0) {
      console.log(`[Harmony Scanner] Processed ${batchCount} batches, ${totalRecords} records so far`);
    }
  }

  console.log(`[Harmony Scanner] getAllRecords: processed ${totalRecords} records in ${batchCount} batches`);

  if (onProgress) {
    onProgress(100, totalRecords);
  }

  // Convert map to sorted array
  const distinctValues: DistinctValue[] = Array.from(valueMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count); // Sort by frequency descending

  return distinctValues;
}
