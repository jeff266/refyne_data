/**
 * Format Function Picker
 *
 * Allows users to select a format function for a harmony and test it live.
 * Shows the 6 available format functions with examples and descriptions.
 */

'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/design-tokens';

export interface FormatFunction {
  id: string;
  name: string;
  example: string;
  description: string;
}

export const FORMAT_FUNCTIONS: FormatFunction[] = [
  {
    id: 'e164_phone',
    name: 'E.164 Phone',
    example: '+15558675309',
    description: 'Standardizes to international phone format',
  },
  {
    id: 'email_lowercase',
    name: 'Email Lowercase',
    example: 'hello@company.com',
    description: 'Lowercases all email addresses',
  },
  {
    id: 'smart_title_case',
    name: 'Smart Title Case',
    example: 'Acme Corp, Inc.',
    description: 'Title case with 152 brand token exceptions',
  },
  {
    id: 'url_canonical',
    name: 'URL Canonical',
    example: 'https://www.domain.com',
    description: 'Adds https://, normalizes www prefix',
  },
  {
    id: 'linkedin_url',
    name: 'LinkedIn URL',
    example: 'https://www.linkedin.com/company/acme',
    description: 'Standardizes LinkedIn company URLs',
  },
  {
    id: 'numeric_parse',
    name: 'Numeric Parse',
    example: '1500000',
    description: 'Extracts numbers from text like "$1.5M"',
  },
  {
    id: 'trim_whitespace',
    name: 'Trim Whitespace',
    example: 'Acme Corp',
    description: 'Removes leading/trailing spaces, collapses multiple',
  },
  {
    id: 'employee_range',
    name: 'Employee Range',
    example: '201-500',
    description: 'Converts employee count to HubSpot range buckets',
  },
  {
    id: 'extract_domain',
    name: 'Extract Domain',
    example: 'acme.com',
    description: 'Extracts domain from URL or normalizes raw domain',
  },
  {
    id: 'state_abbreviate',
    name: 'State Abbreviation',
    example: 'CA',
    description: 'Converts US state names to 2-letter codes',
  },
  {
    id: 'country_code_iso2',
    name: 'Country Code (ISO2)',
    example: 'US',
    description: 'Converts country names to ISO 3166-1 alpha-2 codes',
  },
];

interface FormatFunctionPickerProps {
  selectedFunction: string | null;
  onSelect: (functionId: string) => void;
  objectType: 'company' | 'contact';
}

export function FormatFunctionPicker({
  selectedFunction,
  onSelect,
  objectType,
}: FormatFunctionPickerProps) {
  const [testInput, setTestInput] = useState('555-867-5309');
  const [testOutput, setTestOutput] = useState('');
  const [testing, setTesting] = useState(false);

  // Update test input based on selected function
  useEffect(() => {
    if (selectedFunction) {
      const fn = FORMAT_FUNCTIONS.find((f) => f.id === selectedFunction);
      if (fn) {
        // Set appropriate test input for each function
        switch (fn.id) {
          case 'e164_phone':
            setTestInput('555-867-5309');
            break;
          case 'email_lowercase':
            setTestInput('Hello@Company.COM');
            break;
          case 'smart_title_case':
            setTestInput('acme corporation inc');
            break;
          case 'url_canonical':
            setTestInput('www.example.com');
            break;
          case 'linkedin_url':
            setTestInput('linkedin.com/company/acme-corp');
            break;
          case 'numeric_parse':
            setTestInput('$1.5M');
            break;
          case 'trim_whitespace':
            setTestInput('  Acme   Corp  ');
            break;
          case 'employee_range':
            setTestInput('250');
            break;
          case 'extract_domain':
            setTestInput('https://www.acme.com/about');
            break;
          case 'state_abbreviate':
            setTestInput('California');
            break;
          case 'country_code_iso2':
            setTestInput('United States');
            break;
        }
      }
    }
  }, [selectedFunction]);

  // Test the format function with debounce
  useEffect(() => {
    if (!selectedFunction || !testInput.trim()) {
      setTestOutput('');
      return;
    }

    const timer = setTimeout(async () => {
      setTesting(true);
      try {
        const response = await fetch('/api/harmonies/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transformType: 'format',
            transformFunction: selectedFunction,
            testValue: testInput,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setTestOutput(data.result || '(no output)');
        } else {
          setTestOutput('(error)');
        }
      } catch (error) {
        console.error('[FormatFunctionPicker] Test failed:', error);
        setTestOutput('(error)');
      } finally {
        setTesting(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedFunction, testInput]);

  return (
    <div>
      {/* Function list */}
      <div style={{ marginBottom: 32 }}>
        {FORMAT_FUNCTIONS.map((fn, index) => {
          const isSelected = selectedFunction === fn.id;

          return (
            <div
              key={fn.id}
              onClick={() => onSelect(fn.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '16px 20px',
                marginBottom: index < FORMAT_FUNCTIONS.length - 1 ? 12 : 0,
                border: `1px solid ${isSelected ? C.indigo : C.border}`,
                borderRadius: 8,
                background: isSelected ? `${C.indigo}10` : C.surface,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = C.text3;
                  e.currentTarget.style.background = C.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.background = C.surface;
                }
              }}
            >
              {/* Radio circle */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${isSelected ? C.indigo : C.text3}`,
                  background: isSelected ? C.indigo : 'transparent',
                  marginRight: 16,
                  flexShrink: 0,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
                )}
              </div>

              {/* Function details */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginRight: 12 }}>
                    {fn.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'Monaco, Consolas, monospace',
                      color: C.text3,
                    }}
                  >
                    {fn.id}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: isSelected ? C.indigo : C.text2,
                    fontFamily: 'Monaco, Consolas, monospace',
                    marginBottom: 6,
                  }}
                >
                  {fn.example}
                </div>

                <div style={{ fontSize: 13, color: C.text2 }}>{fn.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live tester */}
      {selectedFunction && (
        <div>
          <h4
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text2,
              marginBottom: 12,
              letterSpacing: '0.5px',
            }}
          >
            TEST IT
          </h4>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 16,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}
          >
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Enter a test value..."
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'Monaco, Consolas, monospace',
                color: C.text,
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = C.indigo;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = C.border;
              }}
            />

            <div
              style={{
                fontSize: 18,
                color: C.text3,
                flexShrink: 0,
              }}
            >
              →
            </div>

            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'Monaco, Consolas, monospace',
                color: testing ? C.text3 : C.indigo,
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                minHeight: 37,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {testing ? 'Testing...' : testOutput || '(no input)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
