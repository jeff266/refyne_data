/**
 * Master record selection logic for dedup clusters.
 *
 * Selects the "richest" record as master based on associations,
 * field completeness, and age.
 */

export interface HubSpotCompany {
  id: string;
  properties: Record<string, string | null>;
}

export interface RichnessScore {
  recordId: string;
  score: number;
  breakdown: {
    contacts: number;
    deals: number;
    fields: number;
    age: number;
  };
}

/**
 * Compute richness score for a record.
 */
export function computeRichness(record: HubSpotCompany, allRecords: HubSpotCompany[]): RichnessScore {
  let score = 0;
  const breakdown = { contacts: 0, deals: 0, fields: 0, age: 0 };

  // Contacts: 3 points each
  const contacts = parseInt(record.properties.num_associated_contacts || '0', 10);
  breakdown.contacts = contacts * 3;
  score += breakdown.contacts;

  // Deals: 5 points each
  const deals = parseInt(record.properties.num_associated_deals || '0', 10);
  breakdown.deals = deals * 5;
  score += breakdown.deals;

  // Field completeness: 1 point per non-empty field
  let filledFields = 0;
  for (const [key, value] of Object.entries(record.properties)) {
    if (value !== null && value !== '' && key !== 'hs_object_id') {
      filledFields++;
    }
  }
  breakdown.fields = filledFields;
  score += filledFields;

  // Age: up to 10 points (older = more history)
  const createDate = record.properties.createdate;
  if (createDate) {
    const createdAt = new Date(createDate).getTime();
    const now = Date.now();
    const ageMs = now - createdAt;

    // Find oldest record in cluster
    let oldestMs = createdAt;
    for (const other of allRecords) {
      const otherDate = other.properties.createdate;
      if (otherDate) {
        const otherCreatedAt = new Date(otherDate).getTime();
        if (otherCreatedAt < oldestMs) {
          oldestMs = otherCreatedAt;
        }
      }
    }

    // Score proportional to age relative to oldest
    if (oldestMs > 0) {
      const ageRatio = (now - createdAt) / (now - oldestMs);
      breakdown.age = Math.round(ageRatio * 10);
      score += breakdown.age;
    }
  }

  return {
    recordId: record.id,
    score,
    breakdown,
  };
}

/**
 * Select master record from cluster.
 * Returns ID of richest record.
 */
export function selectMaster(records: HubSpotCompany[]): string {
  if (records.length === 0) {
    throw new Error('Cannot select master from empty cluster');
  }

  if (records.length === 1) {
    return records[0].id;
  }

  // Compute richness for each record
  const scores = records.map(r => computeRichness(r, records));

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores[0].recordId;
}

/**
 * Auto-select field values for merge.
 * Returns object mapping field name to record ID.
 *
 * Strategy:
 * - Use master's value if non-empty
 * - Otherwise use first non-empty value from others
 */
export function autoSelectFields(
  fields: string[],
  master: HubSpotCompany,
  others: HubSpotCompany[]
): Record<string, string> {
  const selections: Record<string, string> = {};

  for (const field of fields) {
    const masterValue = master.properties[field];

    // Use master if non-empty
    if (masterValue !== null && masterValue !== '') {
      selections[field] = master.id;
      continue;
    }

    // Otherwise find first non-empty value
    let found = false;
    for (const other of others) {
      const otherValue = other.properties[field];
      if (otherValue !== null && otherValue !== '') {
        selections[field] = other.id;
        found = true;
        break;
      }
    }

    // Default to master if all empty
    if (!found) {
      selections[field] = master.id;
    }
  }

  return selections;
}
