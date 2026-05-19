'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';

interface RollbackPreview {
  records_affected: number;
  field_summary: Array<{
    field_name: string;
    count: number;
  }>;
  expiration_date: string;
}

interface RollbackConfirmModalProps {
  isOpen: boolean;
  runId: string;
  shortRunId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RollbackConfirmModal({
  isOpen,
  runId,
  shortRunId,
  onClose,
  onConfirm,
}: RollbackConfirmModalProps) {
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Fetch preview when modal opens
  useEffect(() => {
    if (isOpen && runId) {
      fetchPreview();
    } else {
      // Reset state when modal closes
      setPreview(null);
      setError(null);
      setConfirmInput('');
    }
  }, [isOpen, runId]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/normalize/runs/${runId}/rollback/preview`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch preview');
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmInput !== shortRunId) return;

    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        background: C.surface,
        borderRadius: 12,
        border: `1px solid ${C.border2}`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        fontFamily: F.sans,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: C.redDim,
              border: `1px solid rgba(239,68,68,0.3)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={20} color={C.red} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
                Confirm Rollback
              </h2>
              <p style={{ fontSize: 12, color: C.text2, margin: '2px 0 0 0' }}>
                Run {shortRunId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8,
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: C.text3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={24} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {error && (
            <div style={{
              padding: 12,
              background: C.redDim,
              border: `1px solid rgba(239,68,68,0.3)`,
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {preview && !loading && (
            <>
              {/* Warning */}
              <div style={{
                padding: 12,
                background: C.amberDim,
                border: `1px solid rgba(245,158,11,0.3)`,
                borderRadius: 8,
                marginBottom: 20,
              }}>
                <p style={{ fontSize: 12, color: C.amber, margin: 0, lineHeight: 1.5 }}>
                  This action cannot be undone. Original values will be restored to {preview.records_affected.toLocaleString()} records in HubSpot.
                </p>
              </div>

              {/* Preview Stats */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                  Records Affected
                </div>
                <div style={{ fontSize: 24, color: C.text, fontWeight: 600, fontFamily: F.mono }}>
                  {preview.records_affected.toLocaleString()}
                </div>
              </div>

              {/* Field Summary */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                  Fields to Revert
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {preview.field_summary.map((field, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: C.hover,
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: 11, fontFamily: F.mono, color: C.text }}>{field.field_name}</span>
                      <span style={{ fontSize: 11, color: C.text2 }}>{field.count.toLocaleString()} changes</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Rollback Window Expires
                </div>
                <div style={{ fontSize: 12, color: C.text2 }}>
                  {new Date(preview.expiration_date).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
              </div>

              {/* Confirmation Input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.text2, display: 'block', marginBottom: 8 }}>
                  Type <span style={{ fontFamily: F.mono, color: C.text, fontWeight: 600 }}>{shortRunId}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={shortRunId}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: C.bg,
                    border: `1px solid ${C.border2}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: F.mono,
                    color: C.text,
                    outline: 'none',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = C.indigoBrd}
                  onBlur={(e) => e.currentTarget.style.borderColor = C.border2}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
          background: C.sidebar,
        }}>
          <button
            onClick={onClose}
            disabled={confirming}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: `1px solid ${C.border2}`,
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              color: C.text2,
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.5 : 1,
            }}
            onMouseEnter={(e) => !confirming && (e.currentTarget.style.background = C.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview || confirmInput !== shortRunId || confirming}
            style={{
              padding: '8px 16px',
              background: confirmInput === shortRunId && !confirming
                ? `linear-gradient(to bottom, ${C.red}, #DC2626)`
                : C.text3,
              border: 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              color: '#fff',
              cursor: (!preview || confirmInput !== shortRunId || confirming) ? 'not-allowed' : 'pointer',
              opacity: (!preview || confirmInput !== shortRunId || confirming) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: confirmInput === shortRunId && !confirming
                ? '0 0 0 1px rgba(239,68,68,0.3), 0 1px 3px rgba(0,0,0,0.4)'
                : 'none',
            }}
          >
            {confirming && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Rollback {preview ? preview.records_affected.toLocaleString() : ''} records
          </button>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
