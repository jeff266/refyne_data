'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, Users, DollarSign, ChevronDown } from 'lucide-react';
import { useObjectType, ObjectType } from '@/hooks/useObjectType';
import { C, F } from '@/lib/design-tokens';

const OBJECT_OPTIONS: {
  id: ObjectType;
  label: string;
  available: boolean;
  icon: any;
}[] = [
  { id: 'company', label: 'Companies', available: true, icon: Building2 },
  { id: 'contact', label: 'Contacts', available: true, icon: Users },
  { id: 'deal', label: 'Deals', available: false, icon: DollarSign },
];

export function ObjectSwitcher() {
  const [objectType, setObjectType] = useObjectType();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const current = OBJECT_OPTIONS.find((o) => o.id === objectType) ?? OBJECT_OPTIONS[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          fontFamily: F.mono,
          fontSize: 12,
          color: C.text,
        }}
      >
        <current.icon size={12} color={C.text3} />
        <span>{current.label}</span>
        <ChevronDown size={10} color={C.text3} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: C.surface,
            border: `1px solid ${C.border}`,
            minWidth: 160,
            zIndex: 100,
          }}
        >
          {OBJECT_OPTIONS.map((option) => (
            <button
              key={option.id}
              disabled={!option.available}
              onClick={() => {
                if (option.available) {
                  setObjectType(option.id);
                  setOpen(false);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: option.id === objectType ? C.sidebar : 'transparent',
                border: 'none',
                cursor: option.available ? 'pointer' : 'not-allowed',
                fontFamily: F.mono,
                fontSize: 12,
                color: option.available ? C.text : C.text3,
                textAlign: 'left',
              }}
            >
              <option.icon size={12} color={option.available ? C.text2 : C.text3} />
              <span>{option.label}</span>
              {!option.available && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: C.text3,
                    fontFamily: F.mono,
                  }}
                >
                  soon
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
