'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { SkipDropdown } from './SkipDropdown';

interface PreviewRecord {
  company: string;
  field: string;
  harmonyId: string;
  before: string;
  after: string;
  hubspotCompanyId: string;
  portalId: string;
  ruleExplanation?: string;
  excludable: boolean;
}

interface ByFieldViewProps {
  changes: PreviewRecord[];
  selectedChanges: Set<string>;
  onToggle: (id: string) => void;
  onExclusionCreated: () => void;
}

interface FieldGroup {
  field: string;
  changes: PreviewRecord[];
}

export function ByFieldView({ changes, selectedChanges, onToggle, onExclusionCreated }: ByFieldViewProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Group changes by field
  const fieldGroups: FieldGroup[] = [];
  const fieldMap = new Map<string, FieldGroup>();

  changes.forEach((change) => {
    if (!fieldMap.has(change.field)) {
      const group: FieldGroup = {
        field: change.field,
        changes: [],
      };
      fieldMap.set(change.field, group);
      fieldGroups.push(group);
    }
    fieldMap.get(change.field)!.changes.push(change);
  });

  // Sort by field name
  fieldGroups.sort((a, b) => a.field.localeCompare(b.field));

  const toggleField = (field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const selectAllForField = (field: string, changes: PreviewRecord[]) => {
    changes.forEach((change) => {
      const id = `${change.hubspotCompanyId}:${change.field}`;
      if (!selectedChanges.has(id)) {
        onToggle(id);
      }
    });
  };

  return (
    <div style={{ fontFamily: F.sans }}>
      {fieldGroups.map((group) => {
        const isExpanded = expandedFields.has(group.field);
        const allSelected = group.changes.every((c) =>
          selectedChanges.has(`${c.hubspotCompanyId}:${c.field}`)
        );

        return (
          <div
            key={group.field}
            style={{
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            {/* Field row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 24px',
                gap: 12,
                background: C.sidebar,
              }}
            >
              {/* Expand/collapse button */}
              <button
                onClick={() => toggleField(group.field)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: C.text3,
                }}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {/* Field name */}
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 13,
                  color: C.text,
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                {group.field}
              </span>

              {/* Record count */}
              <span style={{ fontSize: 12, color: C.text3 }}>
                {group.changes.length} record{group.changes.length !== 1 ? 's' : ''}
              </span>

              {/* Select all button */}
              {!allSelected && (
                <button
                  onClick={() => selectAllForField(group.field, group.changes)}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    border: `1px solid ${C.border2}`,
                    borderRadius: 5,
                    fontSize: 11,
                    color: C.text,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Select all
                </button>
              )}
            </div>

            {/* Expanded company rows */}
            {isExpanded && (
              <div style={{ background: C.bg }}>
                {group.changes.map((change) => {
                  const id = `${change.hubspotCompanyId}:${change.field}`;
                  const isSelected = selectedChanges.has(id);

                  return (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 24px 10px 52px',
                        gap: 12,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(id)}
                        style={{
                          width: 14,
                          height: 14,
                          cursor: 'pointer',
                          accentColor: C.indigo,
                        }}
                      />

                      {/* Company name */}
                      <a
                        href={`https://app.hubspot.com/contacts/${change.portalId}/company/${change.hubspotCompanyId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: C.indigo,
                          textDecoration: 'none',
                          fontSize: 12,
                          minWidth: 180,
                        }}
                      >
                        {change.company}
                      </a>

                      {/* Before value */}
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 11,
                          color: C.red,
                          minWidth: 140,
                        }}
                      >
                        {change.before}
                      </span>

                      {/* Arrow */}
                      <span style={{ color: C.text3, fontSize: 11 }}>→</span>

                      {/* After value */}
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 11,
                          color: C.green,
                          minWidth: 140,
                          flex: 1,
                        }}
                      >
                        {change.after}
                      </span>

                      {/* Skip dropdown */}
                      <SkipDropdown
                        companyId={change.hubspotCompanyId}
                        companyName={change.company}
                        field={change.field}
                        currentValue={change.before}
                        onExclusionCreated={onExclusionCreated}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {fieldGroups.length === 0 && (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            color: C.text3,
            fontSize: 13,
          }}
        >
          No changes to display
        </div>
      )}
    </div>
  );
}
