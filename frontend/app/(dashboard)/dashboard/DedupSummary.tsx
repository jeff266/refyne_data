'use client';

import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn } from '@/components/refyne';

interface DedupSummaryProps {
  gradeA: number;
  gradeB: number;
  gradeC: number;
  lastScan?: string;
}

export function DedupSummary({ gradeA, gradeB, gradeC, lastScan }: DedupSummaryProps) {
  const total = gradeA + gradeB + gradeC;

  if (total === 0) {
    return (
      <Card style={{ padding: '20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Duplicates
        </div>
        <div style={{ fontSize: 12, color: C.text3 }}>
          No duplicates detected
        </div>
        {lastScan && (
          <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
            Last scan {lastScan}
          </div>
        )}
      </Card>
    );
  }

  // Calculate dot fills (5 dots max)
  const gradeADots = Math.round((gradeA / total) * 5);
  const gradeBDots = Math.round((gradeB / total) * 5);
  const gradeCDots = Math.max(1, 5 - gradeADots - gradeBDots); // At least 1 if exists

  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
          Duplicates
        </span>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 13, color: C.text, marginBottom: 16 }}>
          {total} pairs pending
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {gradeA > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: gradeADots }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: C.green,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: C.text3 }}>Grade A</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text }}>{gradeA}</span>
                <span style={{ fontSize: 10, color: C.text3 }}>High confidence</span>
              </div>
            </div>
          )}

          {gradeB > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: gradeBDots }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: C.amber,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: C.text3 }}>Grade B</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text }}>{gradeB}</span>
                <span style={{ fontSize: 10, color: C.text3 }}>Review recommended</span>
              </div>
            </div>
          )}

          {gradeC > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: gradeCDots }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: C.text3,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: C.text3 }}>Grade C</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text }}>{gradeC}</span>
                <span style={{ fontSize: 10, color: C.text3 }}>Low priority</span>
              </div>
            </div>
          )}
        </div>

        {gradeA > 0 && (
          <div style={{ width: '100%' }}>
            <PrimaryBtn onClick={() => window.location.href = '/dedup?grade=A'}>
              Review Grade A →
            </PrimaryBtn>
          </div>
        )}
      </div>
    </Card>
  );
}
