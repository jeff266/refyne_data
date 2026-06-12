'use client';

/**
 * FieldSearchCombobox
 *
 * Searchable field picker for HubSpot properties.
 * Uses React portal + position:fixed to escape overflow containers.
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C, F } from '@/lib/design-tokens';
import { Search } from 'lucide-react';

export interface HubSpotProperty {
  name: string;
  label: string;
  type?: string;
  options?: Array<{ label: string; value: string }>;
}

interface FieldSearchComboboxProps {
  properties: HubSpotProperty[];
  value: string;
  onChange: (fieldKey: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FieldSearchCombobox({
  properties,
  value,
  onChange,
  placeholder = 'Search fields...',
  disabled = false,
}: FieldSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find selected property
  const selectedProperty = properties.find(p => p.name === value);

  // Filter properties based on query
  const filteredProperties = query
    ? properties.filter(p =>
        p.label.toLowerCase().includes(query.toLowerCase()) ||
        p.name.toLowerCase().includes(query.toLowerCase())
      )
    : properties;

  // Calculate dropdown position
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: 240,
        overflowY: 'auto',
        background: C.surface,
        border: `1px solid #2E6BA8`,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        setHighlightedIndex(0);
        break;

      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredProperties.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredProperties[highlightedIndex]) {
          handleSelect(filteredProperties[highlightedIndex].name);
        }
        break;
    }
  };

  const handleSelect = (fieldKey: string) => {
    onChange(fieldKey);
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setHighlightedIndex(0);
    if (!isOpen) setIsOpen(true);
  };

  const displayValue = isOpen ? query : selectedProperty?.label || '';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '8px 32px 8px 12px',
            fontSize: 13,
            background: '#1C3654',
            border: `1px solid ${isOpen ? '#2E6BA8' : C.border}`,
            borderRadius: 0,
            color: C.text,
            fontFamily: F.sans,
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <Search
          size={16}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: C.text3,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Dropdown (portal-rendered) */}
      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div ref={dropdownRef} style={dropdownStyle}>
            {filteredProperties.length === 0 ? (
              <div
                style={{
                  padding: '12px 16px',
                  fontSize: 13,
                  color: C.text3,
                  textAlign: 'center',
                }}
              >
                No fields match "{query}"
              </div>
            ) : (
              filteredProperties.map((prop, index) => (
                <div
                  key={prop.name}
                  onClick={() => handleSelect(prop.name)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    padding: '8px 12px',
                    minHeight: 36,
                    cursor: 'pointer',
                    background:
                      index === highlightedIndex || prop.name === value
                        ? '#2E6BA8'
                        : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: C.text,
                      marginBottom: 2,
                      fontFamily: F.sans,
                    }}
                  >
                    {prop.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.text3,
                      fontFamily: 'monospace',
                    }}
                  >
                    {prop.name}
                  </div>
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
