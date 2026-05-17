'use client';

import { C } from '@/lib/design-tokens';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

/**
 * Skeleton for stat cards row.
 */
export function StatCardsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} style={{ padding: '18px 20px' }}>
          <Skeleton width={80} height={11} style={{ marginBottom: 10 }} />
          <Skeleton width={100} height={30} style={{ marginBottom: 8 }} />
          <Skeleton width={120} height={11} />
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton for harmony bars section.
 */
export function HarmonyBarsSkeleton() {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <Skeleton width={160} height={13} />
        <Skeleton width={80} height={11} />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Skeleton width={120} height={12} />
            <Skeleton width={40} height={12} />
          </div>
          <Skeleton width="100%" height={3} />
        </div>
      ))}
    </Card>
  );
}

/**
 * Skeleton for trend chart section.
 */
export function TrendChartSkeleton() {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <Skeleton width={100} height={13} />
        <Skeleton width={60} height={11} />
      </div>
      <Skeleton width="100%" height={120} borderRadius={8} />
    </Card>
  );
}

/**
 * Skeleton for insights section.
 */
export function InsightsSkeleton() {
  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <Skeleton width={60} height={13} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <Skeleton width={3} height={50} />
          <div style={{ flex: 1 }}>
            <Skeleton width={100} height={11} style={{ marginBottom: 6 }} />
            <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} />
            <Skeleton width={60} height={11} />
          </div>
        </div>
      ))}
    </Card>
  );
}

/**
 * Skeleton for portals section.
 */
export function PortalsSkeleton() {
  return (
    <Card style={{ padding: '16px 20px' }}>
      <Skeleton width={60} height={13} style={{ marginBottom: 14 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.hover, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={6} height={6} borderRadius="50%" />
              <div>
                <Skeleton width={100} height={12} style={{ marginBottom: 4 }} />
                <Skeleton width={80} height={10} />
              </div>
            </div>
            <Skeleton width={40} height={10} />
          </div>
        ))}
      </div>
    </Card>
  );
}
