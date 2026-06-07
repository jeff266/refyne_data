'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
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

interface ByCompanyViewProps {
  changes: PreviewRecord[];
  selectedChanges: Set<string>;
  onToggle: (id: string) => void;
  onExclusionCreated: () => void;
}

interface CompanyGroup {
  companyId: string;
  companyName: string;
  portalId: string;
  changes: PreviewRecord[];
}

export function ByCompanyView({ changes, selectedChanges, onToggle, onExclusionCreated }: ByCompanyViewProps) {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  // Group changes by company
  const companyGroups: CompanyGroup[] = [];
  const companyMap = new Map<string, CompanyGroup>();

  changes.forEach((change) => {
    if (!companyMap.has(change.hubspotCompanyId)) {
      const group: CompanyGroup = {
        companyId: change.hubspotCompanyId,
        companyName: change.company,
        portalId: change.portalId,
        changes: [],
      };
      companyMap.set(change.hubspotCompanyId, group);
      companyGroups.push(group);
    }
    companyMap.get(change.hubspotCompanyId)!.changes.push(change);
  });

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleAllFieldsForCompany = (companyId: string, fields: PreviewRecord[]) => {
    const allSelected = fields.every((f) => selectedChanges.has(`${companyId}:${f.field}`));
    fields.forEach((f) => {
      const id = `${companyId}:${f.field}`;
      if (allSelected && selectedChanges.has(id)) {
        onToggle(id);
      } else if (!allSelected && !selectedChanges.has(id)) {
        onToggle(id);
      }
    });
  };

  return (
    <div style={{ fontFamily: F.sans }}>
      {companyGroups.map((group) => {
        const isExpanded = expandedCompanies.has(group.companyId);
        const allSelected = group.changes.every((c) =>
          selectedChanges.has(`${group.companyId}:${c.field}`)
        );
        const someSelected = group.changes.some((c) =>
          selectedChanges.has(`${group.companyId}:${c.field}`)
        );

        return (
          <div
            key={group.companyId}
            style={{
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            {/* Company row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 24px',
                gap: 12,
                background: C.sidebar,
              }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={() => toggleAllFieldsForCompany(group.companyId, group.changes)}
                style={{
                  width: 16,
                  height: 16,
                  cursor: 'pointer',
                  accentColor: C.indigo,
                }}
              />

              {/* Expand/collapse button */}
              <button
                onClick={() => toggleCompany(group.companyId)}
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

              {/* Company name */}
              <a
                href={`https://app.hubspot.com/contacts/${group.portalId}/company/${group.companyId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: C.indigo,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  flex: 1,
                }}
              >
                {group.companyName}
              </a>

              {/* Change count */}
              <span style={{ fontSize: 12, color: C.text3 }}>
                {group.changes.length} change{group.changes.length !== 1 ? 's' : ''}
              </span>

              {/* Skip dropdown */}
              <SkipDropdown
                companyId={group.companyId}
                companyName={group.companyName}
                field=""
                onExclusionCreated={onExclusionCreated}
              />
            </div>

            {/* Expanded field rows */}
            {isExpanded && (
              <div style={{ background: C.bg }}>
                {group.changes.map((change) => {
                  const id = `${group.companyId}:${change.field}`;
                  const isSelected = selectedChanges.has(id);

                  return (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 24px 10px 64px',
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

                      {/* Field name */}
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 11,
                          color: C.text3,
                          minWidth: 140,
                        }}
                      >
                        {change.field}
                      </span>

                      {/* Harmony name pill */}
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 9,
                          color: C.text3,
                          background: C.border2,
                          padding: '2px 6px',
                          borderRadius: 3,
                          opacity: 0.7,
                        }}
                      >
                        {change.harmonyId}
                      </span>

                      {/* Before value */}
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 11,
                          color: C.red,
                          minWidth: 180,
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
                          minWidth: 180,
                          flex: 1,
                        }}
                      >
                        {change.after}
                      </span>

                      {/* Rule explanation tooltip */}
                      {change.ruleExplanation && (
                        <div
                          style={{ position: 'relative', display: 'inline-block' }}
                          title={change.ruleExplanation}
                        >
                          <Info size={14} color={C.text3} style={{ cursor: 'help' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {companyGroups.length === 0 && (
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
