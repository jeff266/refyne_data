'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { C, F } from '@/lib/design-tokens';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

export function Tooltip({ content, children, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position above the trigger, centered
      const left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      const top = triggerRect.top - tooltipRect.height - 8;

      setPosition({ top, left });
    }
  }, [visible]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      {visible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 9999,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 12,
            color: C.text2,
            maxWidth: 400,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
