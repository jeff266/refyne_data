'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';

interface Portal {
  id: string;
  name: string;
  recordCount: number;
  score?: number; // Compliance score percentage
}

interface PortalFilterProps {
  portals: Portal[];
  selectedPortalId: string | null;
  onSelectPortal: (portalId: string | null) => void;
}

export function PortalFilter({ portals, selectedPortalId, onSelectPortal }: PortalFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Hide dropdown if only one portal
  if (portals.length <= 1) {
    return null;
  }

  const totalRecords = portals.reduce((sum, p) => sum + p.recordCount, 0);
  const selectedPortal = portals.find(p => p.id === selectedPortalId);
  const displayText = selectedPortal
    ? selectedPortal.name
    : 'All portals';

  useEffect(() => {
    // Restore from localStorage on mount
    const saved = localStorage.getItem('refyne:dashboard-portal-filter');
    if (saved && portals.find(p => p.id === saved)) {
      onSelectPortal(saved);
    }
  }, [portals]);

  const handleSelect = (portalId: string | null) => {
    onSelectPortal(portalId);
    setIsOpen(false);

    // Persist to localStorage
    if (portalId) {
      localStorage.setItem('refyne:dashboard-portal-filter', portalId);
    } else {
      localStorage.removeItem('refyne:dashboard-portal-filter');
    }

    // Update URL
    const url = new URL(window.location.href);
    if (portalId) {
      url.searchParams.set('portal', portalId);
    } else {
      url.searchParams.delete('portal');
    }
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '6px 12px',
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: 6,
          color: C.text,
          fontSize: 12,
          fontFamily: F.sans,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {displayText}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke={C.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
              onClick={() => handleSelect(null)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: selectedPortalId === null ? C.hover : 'transparent',
                border: 'none',
                borderRadius: 6,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {selectedPortalId === null && '✓ '}All portals
                </div>
                <div style={{ fontSize: 11, color: C.text3, fontFamily: F.mono }}>
                  {totalRecords.toLocaleString()} records
                </div>
              </div>
            </button>

            {portals.map((portal) => {
              const isSelected = portal.id === selectedPortalId;
              return (
                <button
                  key={portal.id}
                  onClick={() => handleSelect(portal.id)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: isSelected ? C.hover : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                      {isSelected ? '✓' : '○'} {portal.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, fontFamily: F.mono }}>
                      {portal.recordCount.toLocaleString()} records
                      {portal.score !== undefined && ` · ${Math.round(portal.score)}%`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
