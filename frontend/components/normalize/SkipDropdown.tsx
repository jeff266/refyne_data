'use client';

import { useState } from 'react';
import { C, F } from '@/lib/design-tokens';

interface SkipDropdownProps {
  companyId: string;
  companyName: string;
  field: string;
  onExclusionCreated: () => void;
}

type ExclusionType = 'skip_once' | 'snooze_7d' | 'snooze_30d' | 'permanent';

export function SkipDropdown({ companyId, companyName, field, onExclusionCreated }: SkipDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleExclude(exclusionType: ExclusionType, fieldLevel: boolean) {
    if (exclusionType === 'permanent') {
      // Show reason modal for permanent exclusions
      setIsReasonModalOpen(true);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/normalize/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          field: fieldLevel ? field : undefined,
          exclusionType,
        }),
      });

      if (response.ok) {
        onExclusionCreated();
        setIsOpen(false);
      } else {
        console.error('Failed to create exclusion');
      }
    } catch (error) {
      console.error('Error creating exclusion:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentExclude(fieldLevel: boolean) {
    setLoading(true);
    try {
      const response = await fetch('/api/normalize/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          field: fieldLevel ? field : undefined,
          exclusionType: 'permanent',
          reason: reason || undefined,
        }),
      });

      if (response.ok) {
        onExclusionCreated();
        setIsReasonModalOpen(false);
        setReason('');
      } else {
        console.error('Failed to create exclusion');
      }
    } catch (error) {
      console.error('Error creating exclusion:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          style={{
            padding: '4px 8px',
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 4,
            color: C.text3,
            fontSize: 12,
            fontFamily: F.sans,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Skip ▾
        </button>

        {isOpen && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999,
              }}
              onClick={() => setIsOpen(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                minWidth: 240,
                background: C.sidebar,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 1000,
                padding: 4,
              }}
            >
              <button
                onClick={() => handleExclude('skip_once', true)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                }}
              >
                Skip this time
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  Don't apply this change now
                </div>
              </button>

              <button
                onClick={() => handleExclude('snooze_7d', true)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                }}
              >
                Snooze 7 days
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  Hide this field for 1 week
                </div>
              </button>

              <button
                onClick={() => handleExclude('snooze_30d', true)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                }}
              >
                Snooze 30 days
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  Hide this field for 1 month
                </div>
              </button>

              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />

              <button
                onClick={() => handleExclude('permanent', true)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: C.red,
                  fontSize: 13,
                  fontFamily: F.sans,
                }}
              >
                Never normalize this field
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  Permanently exclude {field}
                </div>
              </button>

              <button
                onClick={() => {
                  setIsReasonModalOpen(true);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: C.red,
                  fontSize: 13,
                  fontFamily: F.sans,
                }}
              >
                Never normalize {companyName}
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  Permanently exclude entire company
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Reason Modal for Permanent Exclusion */}
      {isReasonModalOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
            onClick={() => setIsReasonModalOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 480,
              maxHeight: '90vh',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Permanently exclude this company?
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
              {companyName} will never be normalized. You can undo this later in the "Skipped" tab.
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              style={{
                width: '100%',
                height: 80,
                padding: 12,
                background: C.bg,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 13,
                fontFamily: F.sans,
                resize: 'none',
                marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setIsReasonModalOpen(false);
                  setReason('');
                }}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handlePermanentExclude(false)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: C.red,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? 'Excluding...' : 'Exclude Permanently'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
