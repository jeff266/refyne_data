/**
 * Screen 3c: Review Canonical Values
 *
 * Shows ranked list of field values with checkboxes and frequency bars.
 * Allows user to select which values to keep as canonical.
 */

'use client';

import { useState } from 'react';
import { C, F } from '@/lib/design-tokens';

interface FieldValue {
  value: string;
  count: number;
  isSuspect: boolean;
  isSelected: boolean;
}

interface Props {
  values: FieldValue[];
  totalRecords: number;
  blankCount: number;
  objectType: string;
  fieldLabel: string;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRename: (index: number, newValue: string) => void;
  onRenamingIndexChange: (index: number | null) => void;
  renamingIndex: number | null;
}

export function Screen3cReviewCanonicals({
  values,
  totalRecords,
  blankCount,
  objectType,
  fieldLabel,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onRename,
  onRenamingIndexChange,
  renamingIndex,
}: Props) {
  const [showSuspects, setShowSuspects] = useState(false);

  const regularValues = values.filter(v => !v.isSuspect);
  const suspectValues = values.filter(v => v.isSuspect);
  const maxCount = values[0]?.count || 1;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        Review your canonical values
      </h3>

      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
        Found {values.length} distinct values in{' '}
        <span style={{ fontWeight: 500, color: C.text }}>{fieldLabel}</span>
        {' '}across {totalRecords} {objectType}s
      </div>

      {blankCount > 0 && (
        <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
          {blankCount} {objectType}s have no value
        </div>
      )}

      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
        Select values to use as canonical. Deselect duplicates, typos, or test values.
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onSelectAll}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontFamily: F.sans,
          }}
        >
          Select all
        </button>
        <button
          onClick={onDeselectAll}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontFamily: F.sans,
          }}
        >
          Deselect all
        </button>
        {suspectValues.length > 0 && (
          <button
            onClick={() => setShowSuspects(!showSuspects)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontFamily: F.sans,
            }}
          >
            {showSuspects ? 'Hide' : 'Show'} {suspectValues.length} suspects
          </button>
        )}
      </div>

      {/* Regular values */}
      <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 24, border: `1px solid ${C.border}` }}>
        {regularValues.map((item, idx) => {
          const actualIdx = values.findIndex(v => v === item);
          return (
            <ValueRow
              key={actualIdx}
              item={item}
              actualIdx={actualIdx}
              maxCount={maxCount}
              isEditing={renamingIndex === actualIdx}
              onToggle={() => onToggle(actualIdx)}
              onStartEdit={() => onRenamingIndexChange(actualIdx)}
              onSaveEdit={(newValue) => {
                onRename(actualIdx, newValue);
                onRenamingIndexChange(null);
              }}
              onCancelEdit={() => onRenamingIndexChange(null)}
            />
          );
        })}
      </div>

      {/* Suspects section */}
      {showSuspects && suspectValues.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 12 }}>
              SUSPECTS (low frequency, possible typos)
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}` }}>
            {suspectValues.map((item) => {
              const actualIdx = values.findIndex(v => v === item);
              return (
                <ValueRow
                  key={actualIdx}
                  item={item}
                  actualIdx={actualIdx}
                  maxCount={maxCount}
                  muted
                  isEditing={renamingIndex === actualIdx}
                  onToggle={() => onToggle(actualIdx)}
                  onStartEdit={() => onRenamingIndexChange(actualIdx)}
                  onSaveEdit={(newValue) => {
                    onRename(actualIdx, newValue);
                    onRenamingIndexChange(null);
                  }}
                  onCancelEdit={() => onRenamingIndexChange(null)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Helper component
interface ValueRowProps {
  item: FieldValue;
  actualIdx: number;
  maxCount: number;
  muted?: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onSaveEdit: (newValue: string) => void;
  onCancelEdit: () => void;
}

function ValueRow({
  item,
  maxCount,
  muted = false,
  isEditing,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ValueRowProps) {
  const percentage = Math.round((item.count / maxCount) * 100);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: `1px solid ${C.border}`,
      opacity: muted ? 0.6 : 1,
    }}>
      <input
        type="checkbox"
        checked={item.isSelected}
        onChange={onToggle}
        style={{ marginRight: 12 }}
      />

      {isEditing ? (
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            type="text"
            defaultValue={item.value}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSaveEdit(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: 13,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontFamily: F.sans,
            }}
            autoFocus
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[type="text"]:focus') as HTMLInputElement;
              if (input) {
                onSaveEdit(input.value);
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.text,
              cursor: 'pointer',
              fontFamily: F.sans,
            }}
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.text,
              cursor: 'pointer',
              fontFamily: F.sans,
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, fontSize: 13, color: item.isSelected ? C.text : C.text3 }}>
            {item.value}
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginRight: 12, width: 40, textAlign: 'right' }}>
            {item.count}
          </div>
          <div style={{ width: 160, height: 6, background: C.border, marginRight: 12 }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              background: '#2E6BA8',
            }} />
          </div>
          <div style={{ fontSize: 11, color: C.text3, width: 40, textAlign: 'right' }}>
            {percentage}%
          </div>
          <button
            onClick={onStartEdit}
            style={{
              marginLeft: 12,
              fontSize: 11,
              padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.text,
              cursor: 'pointer',
              fontFamily: F.sans,
            }}
          >
            rename
          </button>
        </>
      )}
    </div>
  );
}
