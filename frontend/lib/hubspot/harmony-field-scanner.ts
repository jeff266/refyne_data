/**
 * HubSpot Field Scanner for Harmony Wizard
 *
 * Scans a HubSpot field to find all distinct values and their counts.
 * Uses CRM Search API with pagination and rate limiting.
 */

interface ScanOptions {
  orgId: string;
  portalId: string;
  accessToken: string;
  objectType: 'companies' | 'contacts';
  fieldName: string;
  onProgress?: (progress: number, totalRecords: number) => void;
}

interface DistinctValue {
  value: string;
  count: number;
}

export async function scanHubSpotField(options: ScanOptions): Promise<DistinctValue[]> {
  const { orgId, portalId, accessToken, objectType, fieldName, onProgress } = options;

  // Value frequency map
  const valueMap = new Map<string, number>();
  let totalRecords = 0;
  let after = undefined;

  // Paginate through all records
  while (true) {
    const searchBody: any = {
      filterGroups: [],
      properties: [fieldName],
      limit: 100,
    };

    if (after) {
      searchBody.after = after;
    }

    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`HubSpot API error: ${error}`);
    }

    const data = await res.json();
    const results = data.results || [];

    // Aggregate values
    for (const record of results) {
      const value = record.properties?.[fieldName];
      if (value && value.trim()) {
        const trimmedValue = value.trim();
        valueMap.set(trimmedValue, (valueMap.get(trimmedValue) || 0) + 1);
      }
    }

    totalRecords += results.length;

    // Report progress
    if (onProgress) {
      const progress = data.paging?.next ? 50 : 100; // Approximate progress
      onProgress(progress, totalRecords);
    }

    // Check for more pages
    if (data.paging?.next?.after) {
      after = data.paging.next.after;

      // Rate limiting: wait 200ms between requests (max 5 req/sec for search API)
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      break;
    }
  }

  // Convert map to sorted array
  const distinctValues: DistinctValue[] = Array.from(valueMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count); // Sort by frequency descending

  return distinctValues;
}
