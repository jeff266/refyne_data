'use client';

import { useState, useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { addToast } from '@/components/ui/toast';

interface NormalizeExclusion {
  id: string;
  companyId: string;
  companyName?: string;
  field: string | null;
  exclusionType: string;
  reason: string | null;
  expiresAt: string | null;
}

export function SkippedList() {
  const [exclusions, setExclusions] = useState<NormalizeExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchExclusions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/normalize/exclusions');
      if (!response.ok) {
        throw new Error('Failed to fetch exclusions');
      }
      const data = await response.json();
      setExclusions(data.exclusions || []);
    } catch (error) {
      console.error('Failed to fetch exclusions:', error);
      addToast('error', 'Failed to load skipped items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExclusions();
  }, []);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const response = await fetch(`/api/normalize/exclusions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove exclusion');
      }

      addToast('success', 'Exclusion removed');
      fetchExclusions();
    } catch (error) {
      console.error('Failed to remove exclusion:', error);
      addToast('error', 'Failed to remove exclusion');
    } finally {
      setRemovingId(null);
    }
  };

  const getTypeBadge = (type: string, expiresAt: string | null) => {
    if (type === 'skip_once') {
      return (
        <span
          style={{
            padding: '2px 8px',
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 4,
            fontSize: 11,
            color: C.text3,
            fontWeight: 500,
          }}
        >
          Skip once
        </span>
      );
    }

    if (type === 'snooze_7d' || type === 'snooze_30d') {
      const days = type === 'snooze_7d' ? '7d' : '30d';
      return (
        <span
          style={{
            padding: '2px 8px',
            background: C.amberDim,
            border: `1px solid ${C.amberBrd}`,
            borderRadius: 4,
            fontSize: 11,
            color: C.amber,
            fontWeight: 500,
          }}
        >
          Snoozed {days}
        </span>
      );
    }

    if (type === 'permanent') {
      return (
        <span
          style={{
            padding: '2px 8px',
            background: C.redDim,
            border: `1px solid ${C.redBrd}`,
            borderRadius: 4,
            fontSize: 11,
            color: C.red,
            fontWeight: 500,
          }}
        >
          Permanent
        </span>
      );
    }

    return null;
  };

  const formatExpiresAt = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';

    const date = new Date(expiresAt);
    const now = new Date();

    if (date < now) {
      return 'Expired';
    }

    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        <Loader2 size={24} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (exclusions.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          fontFamily: F.sans,
        }}
      >
        <div style={{ fontSize: 14, color: C.text2, marginBottom: 8 }}>No exclusions yet</div>
        <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', maxWidth: 360 }}>
          When you skip changes, they'll appear here. You can remove exclusions to allow
          normalization again.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F.sans }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.sidebar }}>
            <th
              style={{
                padding: '10px 24px',
                textAlign: 'left',
                color: C.text3,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.03em',
              }}
            >
              Company
            </th>
            <th
              style={{
                padding: '10px 24px',
                textAlign: 'left',
                color: C.text3,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.03em',
              }}
            >
              Field
            </th>
            <th
              style={{
                padding: '10px 24px',
                textAlign: 'left',
                color: C.text3,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.03em',
              }}
            >
              Type
            </th>
            <th
              style={{
                padding: '10px 24px',
                textAlign: 'left',
                color: C.text3,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.03em',
              }}
            >
              Expires
            </th>
            <th
              style={{
                padding: '10px 24px',
                textAlign: 'left',
                color: C.text3,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.03em',
              }}
            >
              Reason
            </th>
            <th
              style={{
                padding: '10px 24px',
                textAlign: 'right',
                color: C.text3,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.03em',
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {exclusions.map((exclusion) => (
            <tr key={exclusion.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '12px 24px', color: C.text, fontSize: 12 }}>
                {exclusion.companyName || exclusion.companyId}
              </td>
              <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.text3, fontSize: 11 }}>
                {exclusion.field || <em style={{ color: C.text3 }}>All fields</em>}
              </td>
              <td style={{ padding: '12px 24px' }}>
                {getTypeBadge(exclusion.exclusionType, exclusion.expiresAt)}
              </td>
              <td style={{ padding: '12px 24px', color: C.text3, fontSize: 11 }}>
                {formatExpiresAt(exclusion.expiresAt)}
              </td>
              <td
                style={{
                  padding: '12px 24px',
                  color: C.text3,
                  fontSize: 11,
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {exclusion.reason || '—'}
              </td>
              <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                <button
                  onClick={() => handleRemove(exclusion.id)}
                  disabled={removingId === exclusion.id}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    border: `1px solid ${C.border2}`,
                    borderRadius: 5,
                    fontSize: 11,
                    color: C.red,
                    cursor: removingId === exclusion.id ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    opacity: removingId === exclusion.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) =>
                    removingId !== exclusion.id && (e.currentTarget.style.background = C.hover)
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {removingId === exclusion.id ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
