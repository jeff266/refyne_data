'use client';

import { useState, useEffect, useRef } from 'react';

const COLORS = {
  surface2: '#1e3454',
  border: 'rgba(255,255,255,0.14)',
  text: '#F9F8F5',
  text2: '#A1A1AA',
  text3: '#71717A',
  selectedHighlight: 'rgba(46,107,168,0.2)',
  hover: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.1)',
};

export interface CustomDropdownOption {
  value: string;
  label: string;
  badge?: string;
  count?: number;
  group?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  placeholder?: string;
  searchable?: boolean;
  maxHeight?: number;
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = true,
  maxHeight = 320,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Filter options by search query
  const filteredOptions = searchQuery
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Group options
  const groupedOptions: { [key: string]: CustomDropdownOption[] } = {};
  const ungroupedOptions: CustomDropdownOption[] = [];

  filteredOptions.forEach(opt => {
    if (opt.group) {
      if (!groupedOptions[opt.group]) {
        groupedOptions[opt.group] = [];
      }
      groupedOptions[opt.group].push(opt);
    } else {
      ungroupedOptions.push(opt);
    }
  });

  // Sort groups: ungrouped first, then imported lists
  const sortedGroups = Object.keys(groupedOptions).sort((a, b) => {
    if (a === 'Company lists') return -1;
    if (b === 'Company lists') return 1;
    return a.localeCompare(b);
  });

  // Sort items within groups: non-csv/xlsx first, then imported
  const sortGroupItems = (items: CustomDropdownOption[]) => {
    return [...items].sort((a, b) => {
      const aIsImported = a.badge && ['xlsx', 'csv'].includes(a.badge);
      const bIsImported = b.badge && ['xlsx', 'csv'].includes(b.badge);
      if (aIsImported && !bIsImported) return 1;
      if (!aIsImported && bIsImported) return -1;
      return a.label.localeCompare(b.label);
    });
  };

  // Get selected option label
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Truncate label helper
  const truncateLabel = (label: string, maxChars: number = 36) => {
    return label.length > maxChars ? label.substring(0, maxChars) + '...' : label;
  };

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: COLORS.surface2,
          border: `0.5px solid ${COLORS.border}`,
          borderRadius: 0,
          color: COLORS.text,
          fontSize: 13,
          fontFamily: 'Jost, sans-serif',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ color: value ? COLORS.text : COLORS.text2 }}>
          {truncateLabel(displayLabel, 36)}
        </span>
        <span style={{ fontSize: 10, color: COLORS.text2 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown overlay and menu */}
      {isOpen && (
        <>
          {/* Fixed overlay */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          />

          {/* Dropdown menu */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: COLORS.surface2,
              border: `0.5px solid ${COLORS.border}`,
              borderRadius: 0,
              maxHeight: maxHeight,
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {/* Search input */}
            {searchable && (
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: `0.5px solid ${COLORS.divider}`,
                }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: COLORS.surface2,
                    border: 'none',
                    borderRadius: 0,
                    color: COLORS.text,
                    fontSize: 13,
                    fontFamily: 'Jost, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Options list */}
            <div>
              {filteredOptions.length === 0 ? (
                <div
                  style={{
                    padding: '12px',
                    color: COLORS.text2,
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  No results found
                </div>
              ) : (
                <>
                  {/* Ungrouped options */}
                  {sortGroupItems(ungroupedOptions).map((opt) => (
                    <DropdownItem
                      key={opt.value}
                      option={opt}
                      isSelected={opt.value === value}
                      onSelect={handleSelect}
                      truncateLabel={truncateLabel}
                    />
                  ))}

                  {/* Grouped options */}
                  {sortedGroups.map((groupName) => (
                    <div key={groupName}>
                      {/* Group divider */}
                      <div
                        style={{
                          padding: '8px 12px',
                          fontSize: 10,
                          color: COLORS.text3,
                          fontFamily: 'Jost, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderTop: `0.5px solid ${COLORS.divider}`,
                          borderBottom: `0.5px solid ${COLORS.divider}`,
                        }}
                      >
                        ─── {groupName} ───
                      </div>

                      {/* Group items */}
                      {sortGroupItems(groupedOptions[groupName]).map((opt) => (
                        <DropdownItem
                          key={opt.value}
                          option={opt}
                          isSelected={opt.value === value}
                          onSelect={handleSelect}
                          truncateLabel={truncateLabel}
                        />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface DropdownItemProps {
  option: CustomDropdownOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
  truncateLabel: (label: string, maxChars?: number) => string;
}

function DropdownItem({ option, isSelected, onSelect, truncateLabel }: DropdownItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(option.value)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={option.label}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        background: isSelected
          ? COLORS.selectedHighlight
          : isHovered
          ? COLORS.hover
          : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 13,
        fontFamily: 'Jost, sans-serif',
        color: COLORS.text,
      }}
    >
      {/* Label on left */}
      <span>{truncateLabel(option.label, 36)}</span>

      {/* Badge + count on right */}
      {(option.badge || option.count !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {option.badge && (
            <span
              style={{
                fontSize: 10,
                color: COLORS.text3,
                background: 'rgba(255,255,255,0.05)',
                padding: '2px 6px',
                borderRadius: 2,
                fontFamily: 'Jost, sans-serif',
              }}
            >
              {option.badge}
            </span>
          )}
          {option.count !== undefined && (
            <span style={{ fontSize: 12, color: COLORS.text2 }}>
              · {option.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
