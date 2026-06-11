'use client';

import { C, F } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';
import { Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface AlwaysOnUpsellProps {
  recordsToNormalize: number;
  potentialDuplicates: number;
  fieldsToFill: number;
}

export function AlwaysOnUpsell({
  recordsToNormalize,
  potentialDuplicates,
  fieldsToFill,
}: AlwaysOnUpsellProps) {
  return (
    <Card
      style={{
        padding: '28px 32px',
        background: '#1C3654',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 0,
        marginBottom: 28,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 20,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: C.indigoDim,
            border: `1px solid ${C.indigoBrd}`,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Zap size={24} color={C.indigo} />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              fontFamily: F.serif,
              color: C.text,
              marginBottom: 8,
            }}
          >
            Always On is not enabled
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.text2,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            Refyne can work overnight while you sleep. Enable Always On to get daily digests and
            automatic data quality improvements.
          </div>

          {/* Real data preview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: F.sans,
                  color: C.text3,
                  marginBottom: 6,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Records to normalize
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  fontFamily: F.serif,
                  color: C.text,
                  lineHeight: 1,
                }}
              >
                {recordsToNormalize.toLocaleString()}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: F.sans,
                  color: C.text3,
                  marginBottom: 6,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Potential duplicates
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  fontFamily: F.serif,
                  color: C.text,
                  lineHeight: 1,
                }}
              >
                {potentialDuplicates.toLocaleString()}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: F.sans,
                  color: C.text3,
                  marginBottom: 6,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Fields to fill
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  fontFamily: F.serif,
                  color: C.text,
                  lineHeight: 1,
                }}
              >
                {fieldsToFill.toLocaleString()}
              </div>
            </div>
          </div>

          <Link
            href="/settings/notifications"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: C.indigo,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Set up Always On
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </Card>
  );
}
