/**
 * Screen 4: Review Mappings
 *
 * Displays canonical values and mappings for review before activation.
 * Handles three different value sources: pack, field, blank.
 */

'use client';

import { C, F } from '@/lib/design-tokens';
import type { PackEntry, ReadFieldValue, ReadFieldMetadata } from '../hooks/useTaxonomyWizard';

interface Screen4Props {
  valueSource: 'pack' | 'field' | 'blank';

  // Pack source
  selectedPackName?: string;
  packEntries: PackEntry[];
  groupedEntries: Record<string, PackEntry[]>;

  // Field source
  readFromFieldLabel?: string;
  readFieldValues: ReadFieldValue[];
  readFieldMetadata: ReadFieldMetadata | null;
  showSuspects: boolean;
  renamingIndex: number | null;
  onToggleSelection: (index: number) => void;
  onRename: (index: number, newValue: string) => void;
  onShowSuspectsToggle: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRenamingIndexChange: (index: number | null) => void;
}

export function Screen4ReviewMappings({
  valueSource,
  selectedPackName,
  packEntries,
  groupedEntries,
  readFromFieldLabel,
  readFieldValues,
  readFieldMetadata,
  showSuspects,
  renamingIndex,
  onToggleSelection,
  onRename,
  onShowSuspectsToggle,
  onSelectAll,
  onDeselectAll,
  onRenamingIndexChange,
}: Screen4Props) {
  if (valueSource === 'pack') {
    return (
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Review mappings
        </h3>

        <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
          {selectedPackName} pack · {packEntries.length} mappings loaded
        </div>

        {/* Canonical Values */}
        <div style={{ marginBottom: 32 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            CANONICAL VALUES (what gets written)
          </h4>
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            {Object.entries(groupedEntries).map(([canonical, entries]) => (
              <div
                key={canonical}
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{canonical}</span>
                  <span style={{ fontSize: 12, color: C.text3, marginLeft: 12 }}>
                    {entries.length} mappings
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input Mappings Preview */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            INPUT MAPPINGS
          </h4>
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {packEntries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '10px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: 12,
                }}
              >
                <span style={{ color: C.text2, flex: 1 }}>{entry.input_value}</span>
                <span style={{ color: C.text3 }}>→</span>
                <span style={{ color: C.text, flex: 1 }}>{entry.canonical_value}</span>
              </div>
            ))}
            {packEntries.length > 10 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: C.text3, textAlign: 'center' }}>
                + {packEntries.length - 10} more
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (valueSource === 'field') {
    const maxCount = readFieldValues[0]?.count || 1;

    return (
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Review your canonical values
        </h3>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 24 }}>
          Found {readFieldMetadata?.uniqueValueCount} distinct values in{' '}
          <span style={{ fontWeight: 500, color: C.text }}>{readFromFieldLabel}</span>
          {' '}across {readFieldMetadata?.totalRecords} companies
        </div>

        {readFieldMetadata && readFieldMetadata.blankCount > 0 && (
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
            {readFieldMetadata.blankCount} companies have no value
          </div>
        )}

        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Select the values you want to keep as canonical. Deselect any that are duplicates, typos, or garbage.
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
          <button
            onClick={onShowSuspectsToggle}
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
            {showSuspects ? 'Hide' : 'Show'} suspects ({readFieldValues.filter(v => v.isSuspect).length})
          </button>
        </div>

        {/* Value list - non-suspects */}
        <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 24, border: `1px solid ${C.border}` }}>
          {readFieldValues.filter(v => !v.isSuspect).map((item, idx) => {
            const actualIdx = readFieldValues.findIndex(v => v === item);
            const percentage = Math.round((item.count / maxCount) * 100);

            return (
              <div
                key={actualIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={item.isSelected}
                  onChange={() => onToggleSelection(actualIdx)}
                  style={{ marginRight: 12 }}
                />

                {renamingIndex === actualIdx ? (
                  <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      defaultValue={item.value}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRename(actualIdx, e.currentTarget.value);
                          onRenamingIndexChange(null);
                        } else if (e.key === 'Escape') {
                          onRenamingIndexChange(null);
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
                          onRename(actualIdx, input.value);
                        }
                        onRenamingIndexChange(null);
                      }}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => onRenamingIndexChange(null)}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ flex: 1, fontSize: 13, color: item.isSelected ? C.text : C.text3 }}>
                    {item.value}
                  </div>
                )}

                <div style={{ fontSize: 12, color: C.text3, marginRight: 12, width: 40, textAlign: 'right' }}>
                  {item.count}
                </div>

                <div style={{ width: 120, height: 8, background: C.border, borderRadius: 2, marginRight: 12 }}>
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: '#2E6BA8',
                      borderRadius: 2,
                    }}
                  />
                </div>

                <div style={{ fontSize: 11, color: C.text3, width: 40, textAlign: 'right' }}>
                  {percentage}%
                </div>

                {!renamingIndex && (
                  <button
                    onClick={() => onRenamingIndexChange(actualIdx)}
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
                )}
              </div>
            );
          })}
        </div>

        {/* Suspect section */}
        {showSuspects && readFieldValues.some(v => v.isSuspect) && (
          <>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 12 }}>
                SUSPECTS (low frequency, possible typos)
              </div>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}` }}>
              {readFieldValues.filter(v => v.isSuspect).map((item) => {
                const actualIdx = readFieldValues.findIndex(v => v === item);
                const percentage = Math.round((item.count / maxCount) * 100);

                return (
                  <div
                    key={actualIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: `1px solid ${C.border}`,
                      opacity: 0.6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.isSelected}
                      onChange={() => onToggleSelection(actualIdx)}
                      style={{ marginRight: 12 }}
                    />
                    <div style={{ flex: 1, fontSize: 13, color: C.text3 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, marginRight: 12, width: 40, textAlign: 'right' }}>
                      {item.count}
                    </div>
                    <div style={{ width: 120, height: 8, background: C.border, borderRadius: 2, marginRight: 12 }}>
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: '#2E6BA8',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, width: 40, textAlign: 'right' }}>
                      {percentage}%
                    </div>
                    <div style={{ width: 65, marginLeft: 12 }} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Blank source
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        Review mappings
      </h3>
      <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
        Starting with blank canonical values
      </div>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>
          No pre-loaded canonical values
        </div>
        <div style={{ fontSize: 12, color: C.text3 }}>
          Refyne will suggest mappings as it encounters new values during normalization
        </div>
      </div>
    </div>
  );
}
