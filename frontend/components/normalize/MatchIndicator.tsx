'use client';

import { C, F } from '@/lib/design-tokens';
import { Tooltip } from '@/components/refyne';

interface MatchIndicatorProps {
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'none';
  confidence: number;
}

export function MatchIndicator({ matchType, confidence }: MatchIndicatorProps) {
  if (matchType === 'exact') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: C.green,
          fontFamily: F.mono,
        }}
      >
        ✓ exact
      </span>
    );
  }

  if (matchType === 'fuzzy') {
    return (
      <Tooltip
        content={
          <div style={{ maxWidth: 300 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Fuzzy Match ({confidence}%)</div>
            <div style={{ fontSize: 11, color: C.text3 }}>
              This value was matched using trigram similarity. The confidence score indicates how close the match is.
              Values above 80% are typically accurate, but you should verify this change before applying.
            </div>
          </div>
        }
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: C.amber,
            fontFamily: F.mono,
            cursor: 'help',
          }}
        >
          ⚠ fuzzy {confidence}%
        </span>
      </Tooltip>
    );
  }

  if (matchType === 'phonetic') {
    return (
      <Tooltip
        content={
          <div style={{ maxWidth: 300 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Phonetic Match ({confidence}%)</div>
            <div style={{ fontSize: 11, color: C.text3 }}>
              This value was matched using phonetic similarity (sounds like the canonical value).
              Phonetic matches are less reliable than fuzzy matches. Please review carefully before applying.
            </div>
          </div>
        }
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: '#f97316', // orange
            fontFamily: F.mono,
            cursor: 'help',
          }}
        >
          ⚠ phonetic {confidence}%
        </span>
      </Tooltip>
    );
  }

  return null;
}

interface FuzzyMatchBannerProps {
  fuzzyCount: number;
  phoneticCount: number;
}

export function FuzzyMatchBanner({ fuzzyCount, phoneticCount }: FuzzyMatchBannerProps) {
  const total = fuzzyCount + phoneticCount;

  if (total === 0) return null;

  return (
    <div
      style={{
        padding: '12px 16px',
        background: C.amberDim,
        border: `1px solid ${C.amberBrd}`,
        borderRadius: 8,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 16 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>
          {total} {total === 1 ? 'change is a fuzzy match' : 'changes are fuzzy matches'}
        </div>
        <div style={{ fontSize: 11, color: C.text2 }}>
          {fuzzyCount > 0 && `${fuzzyCount} fuzzy match${fuzzyCount > 1 ? 'es' : ''}`}
          {fuzzyCount > 0 && phoneticCount > 0 && ', '}
          {phoneticCount > 0 && `${phoneticCount} phonetic match${phoneticCount > 1 ? 'es' : ''}`}
          {' — Review before applying'}
        </div>
      </div>
    </div>
  );
}
