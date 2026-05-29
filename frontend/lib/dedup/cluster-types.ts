/**
 * Dedup Cluster Types
 *
 * Type definitions for cluster-based dedup review.
 */

import type { PairGrade } from './types';
import type { HubSpotCompany } from './select-master';

export interface DedupCluster {
  id: string;
  orgId: string;
  portalId: string;
  connectionId: string | null;
  grade: PairGrade;
  recordIds: string[];
  pairIds: string[];
  status: 'pending' | 'merged' | 'rejected' | 'skipped';
  mergedInto: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clusterName?: string; // Company name from first record
}

export interface DedupClusterRow {
  id: string;
  org_id: string;
  portal_id: string;
  connection_id: string | null;
  grade: PairGrade;
  record_ids: string[];
  pair_ids: string[];
  status: 'pending' | 'merged' | 'rejected' | 'skipped';
  merged_into: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClusterWithRecords {
  cluster: DedupCluster;
  records: HubSpotCompany[];
  suggestedMasterId: string;
  signals?: string[];
  survivorshipReasons?: Record<string, { rule: string; source?: string }>;
}

export interface ClustersCounts {
  byGrade: Record<PairGrade, number>;
  byStatus: {
    pending: number;
    merged: number;
    rejected: number;
    skipped: number;
  };
}

export interface ClustersListResponse {
  clusters: DedupCluster[];
  total: number;
  counts: ClustersCounts;
}

/**
 * Convert database row to DedupCluster.
 */
export function rowToCluster(row: DedupClusterRow): DedupCluster {
  return {
    id: row.id,
    orgId: row.org_id,
    portalId: row.portal_id,
    connectionId: row.connection_id,
    grade: row.grade,
    recordIds: row.record_ids,
    pairIds: row.pair_ids,
    status: row.status,
    mergedInto: row.merged_into,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
