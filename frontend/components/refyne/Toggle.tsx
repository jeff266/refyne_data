'use client';

import { C } from '@/lib/design-tokens';

interface ToggleProps {
  on: boolean;
  onToggle: () => void;
}

export function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        background: on ? C.indigo : C.hover,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        border: `1px solid ${on ? C.indigoBrd : C.border2}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 15 : 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: on ? '#fff' : C.text3,
          transition: 'left 0.15s',
        }}
      />
    </div>
  );
}
