'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';
import { Settings } from 'lucide-react';
import Link from 'next/link';

interface FieldFillRate {
  name: string;
  label: string;
  filled: number;
  total: number;
  rate: number;
}

interface FieldCoverageSectionProps {
  orgId: string;
}

const MAX_FIELDS = 8;

// Default field selections
const DEFAULT_COMPANY_FIELDS = ['industry', 'numberofemployees', 'phone', 'linkedin_company_page', 'annualrevenue', 'website'];
const DEFAULT_CONTACT_FIELDS = ['email', 'phone', 'jobtitle', 'company', 'linkedin_url', 'city'];

export function FieldCoverageSection({ orgId }: FieldCoverageSectionProps) {
  const [activeTab, setActiveTab] = useState<'company' | 'contact'>('company');
  const [companyRates, setCompanyRates] = useState<FieldFillRate[]>([]);
  const [contactRates, setContactRates] = useState<FieldFillRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  // Load selected fields from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = `refyne_dashboard_fields_${activeTab}_${orgId}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        setSelectedFields(JSON.parse(stored));
      } catch {
        // If parse fails, use defaults
        setSelectedFields(
          activeTab === 'company' ? DEFAULT_COMPANY_FIELDS : DEFAULT_CONTACT_FIELDS
        );
      }
    } else {
      // No stored value, use defaults
      setSelectedFields(
        activeTab === 'company' ? DEFAULT_COMPANY_FIELDS : DEFAULT_CONTACT_FIELDS
      );
    }
  }, [activeTab, orgId]);

  // Fetch fill rates for both object types
  useEffect(() => {
    const fetchFillRates = async () => {
      setLoading(true);
      setError(null);
      try {
        const [companyRes, contactRes] = await Promise.all([
          fetch('/api/dashboard/fill-rates?objectType=company'),
          fetch('/api/dashboard/fill-rates?objectType=contact'),
        ]);

        if (companyRes.ok) {
          const companyData = await companyRes.json();
          setCompanyRates(companyData.fillRates || []);
        } else {
          console.warn('Company fill rates API returned error:', await companyRes.text());
        }

        if (contactRes.ok) {
          const contactData = await contactRes.json();
          setContactRates(contactData.fillRates || []);
        } else {
          console.warn('Contact fill rates API returned error:', await contactRes.text());
        }

        // If both failed, show error
        if (!companyRes.ok && !contactRes.ok) {
          setError('Unable to load field coverage data');
        }
      } catch (err) {
        console.error('Failed to fetch fill rates:', err);
        setError('Unable to load field coverage data');
      } finally {
        setLoading(false);
      }
    };

    fetchFillRates();
  }, []);

  // Get current rates based on active tab
  const currentRates = activeTab === 'company' ? companyRates : contactRates;

  // Filter to selected fields
  const displayedRates = currentRates.filter((r) => selectedFields.includes(r.name));

  const toggleFieldSelection = (fieldName: string) => {
    let newSelection: string[];

    if (selectedFields.includes(fieldName)) {
      // Deselect (but keep at least 1 field)
      if (selectedFields.length === 1) return;
      newSelection = selectedFields.filter((f) => f !== fieldName);
    } else {
      // Select (but max 8)
      if (selectedFields.length >= MAX_FIELDS) return;
      newSelection = [...selectedFields, fieldName];
    }

    setSelectedFields(newSelection);

    // Save to localStorage
    const storageKey = `refyne_dashboard_fields_${activeTab}_${orgId}`;
    localStorage.setItem(storageKey, JSON.stringify(newSelection));
  };

  return (
    <Card style={{ padding: '20px 24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              letterSpacing: '-0.01em',
            }}
          >
            Field Coverage
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setActiveTab('company')}
              style={{
                padding: '4px 12px',
                background: activeTab === 'company' ? C.indigoDim : 'transparent',
                border: `1px solid ${activeTab === 'company' ? C.indigoBrd : C.border}`,
                color: activeTab === 'company' ? C.indigo : C.text3,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              Companies
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              style={{
                padding: '4px 12px',
                background: activeTab === 'contact' ? C.indigoDim : 'transparent',
                border: `1px solid ${activeTab === 'contact' ? C.indigoBrd : C.border}`,
                color: activeTab === 'contact' ? C.indigo : C.text3,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              Contacts
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: showConfig ? C.indigoDim : 'transparent',
            border: `1px solid ${showConfig ? C.indigoBrd : C.border}`,
            color: showConfig ? C.indigo : C.text3,
            fontSize: 11,
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          <Settings size={12} />
          Configure fields
        </button>
      </div>

      {showConfig && (
        <div
          style={{
            padding: '16px',
            background: C.hover,
            border: `1px solid ${C.border}`,
            marginBottom: 16,
            borderRadius: 0,
          }}
        >
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 12 }}>
            Select up to {MAX_FIELDS} fields to display (min 1)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentRates.map((field) => {
              const isSelected = selectedFields.includes(field.name);
              return (
                <label
                  key={field.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: C.text2,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFieldSelection(field.name)}
                    disabled={
                      (!isSelected && selectedFields.length >= MAX_FIELDS) ||
                      (isSelected && selectedFields.length === 1)
                    }
                    style={{ cursor: 'pointer' }}
                  />
                  {field.label}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  height: 12,
                  background: C.hover,
                  width: '40%',
                  borderRadius: 0,
                }}
              />
              <div
                style={{
                  height: 6,
                  background: C.hover,
                  width: '100%',
                  borderRadius: 0,
                }}
              />
            </div>
          ))}
        </div>
      ) : error ? (
        <div
          style={{
            fontSize: 13,
            color: C.text3,
            textAlign: 'center',
            padding: '32px 0',
          }}
        >
          {error}
        </div>
      ) : displayedRates.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: C.text3,
            textAlign: 'center',
            padding: '32px 0',
          }}
        >
          No field data available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayedRates.map((field) => (
            <Link
              key={field.name}
              href={`/enrich?field=${field.name}`}
              style={{
                textDecoration: 'none',
                display: 'block',
                cursor: 'pointer',
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: F.sans,
                      color: C.text2,
                    }}
                  >
                    {field.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: F.mono,
                      color: C.text,
                      fontWeight: 500,
                    }}
                  >
                    {field.rate}%
                  </span>
                </div>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: C.border,
                  position: 'relative',
                  borderRadius: 0,
                }}
              >
                <div
                  style={{
                    width: `${field.rate}%`,
                    height: '100%',
                    background: '#2E6BA8',
                    borderRadius: 0,
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
