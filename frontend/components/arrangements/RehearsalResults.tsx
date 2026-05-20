'use client';

import { C, F } from '@/lib/design-tokens';

interface RehearsalField {
  record: string;
  field: string;
  before: string | null;
  after: string | null;
  source: string | null;
}

interface ProviderStats {
  provider: string;
  fieldsFilled: number;
  fillRate: number;
}

interface CostEstimate {
  provider: string;
  credits: number;
  managed: boolean;
  remaining?: number;
  total?: number;
}

interface RehearsalResultsProps {
  fields: RehearsalField[];
  providerStats: ProviderStats[];
  costEstimates: CostEstimate[];
  totalRecords: number;
  sampleSize: number;
  onAdjustWaterfall?: () => void;
  aiSummary?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  apollo: C.indigo,
  clearbit: C.green,
  zoominfo: C.amber,
  serper: C.yellow,
};

export function RehearsalResults({
  fields,
  providerStats,
  costEstimates,
  totalRecords,
  sampleSize,
  onAdjustWaterfall,
  aiSummary,
}: RehearsalResultsProps) {
  const totalFieldsFilled = providerStats.reduce((sum, p) => sum + p.fieldsFilled, 0);
  const totalPossibleFields = sampleSize * 5; // Assuming 5 fields per record for demo
  const combinedFillRate = totalFieldsFilled / totalPossibleFields;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          fontSize: 13,
          color: C.text2,
          marginBottom: 24,
        }}
      >
        Tested on {sampleSize} sample records. No credits used. No HubSpot writes.
      </div>

      {/* Fill rate by provider */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 16,
          }}
        >
          Fill rate by provider
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {providerStats.map((stat) => {
            const color = PROVIDER_COLORS[stat.provider.toLowerCase()] || C.text3;
            return (
              <div
                key={stat.provider}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 80,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                  }}
                >
                  {stat.provider}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 24,
                    background: C.bg,
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${stat.fillRate * 100}%`,
                      height: '100%',
                      background: color,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 60,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.text,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(stat.fillRate * 100)}%
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: C.text3,
                    width: 140,
                  }}
                >
                  (filled {stat.fieldsFilled} fields)
                </div>
              </div>
            );
          })}

          {/* Combined */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingTop: 12,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                width: 80,
                fontSize: 12,
                fontWeight: 600,
                color: C.text,
              }}
            >
              Combined
            </div>
            <div
              style={{
                flex: 1,
                height: 24,
                background: C.bg,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${combinedFillRate * 100}%`,
                  height: '100%',
                  background: C.green,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div
              style={{
                width: 60,
                fontSize: 12,
                fontWeight: 600,
                color: C.text,
                textAlign: 'right',
              }}
            >
              {Math.round(combinedFillRate * 100)}%
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.text3,
                width: 140,
              }}
            >
              of all empty fields
            </div>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <th
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Record
              </th>
              <th
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Field
              </th>
              <th
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Before
              </th>
              <th
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                After
              </th>
              <th
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.slice(0, 20).map((field, idx) => {
              const hasMatch = field.source !== null;
              const color = field.source
                ? PROVIDER_COLORS[field.source.toLowerCase()] || C.text3
                : C.text3;

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <td
                    style={{
                      padding: '12px 16px',
                      color: C.text,
                      fontWeight: 500,
                    }}
                  >
                    {field.record}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      color: C.text2,
                      fontFamily: F.mono,
                      fontSize: 11,
                    }}
                  >
                    {field.field}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      color: C.text3,
                      fontStyle: 'italic',
                    }}
                  >
                    {field.before || '(empty)'}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      color: hasMatch ? C.text : C.red,
                      fontWeight: hasMatch ? 500 : 400,
                    }}
                  >
                    {field.after || '(no match)'}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                    }}
                  >
                    {hasMatch ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: color,
                          }}
                        />
                        <span style={{ color: C.text2 }}>{field.source}</span>
                      </div>
                    ) : (
                      <span style={{ color: C.text3 }}>✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: C.text3,
          }}
        >
          {providerStats.map((stat) => {
            const color = PROVIDER_COLORS[stat.provider.toLowerCase()] || C.text3;
            return (
              <div
                key={stat.provider}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                  }}
                />
                {stat.provider}
              </div>
            );
          })}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: C.text3 }}>✗</span>
            No match
          </div>
        </div>
      </div>

      {/* Cost estimate */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
          }}
        >
          Cost estimate
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.text2,
            marginBottom: 12,
          }}
        >
          Full run on {totalRecords} records:
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {costEstimates.map((est) => (
            <div
              key={est.provider}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
              }}
            >
              <span style={{ color: C.text }}>
                {est.provider}: <strong>~{est.credits} credits</strong>
              </span>
              <span style={{ color: C.text3 }}>
                {est.managed
                  ? `(Refyne managed · ${est.remaining} of ${est.total} left)`
                  : '(BYOK — your key, no limit)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 12,
            }}
          >
            AI summary
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: '1.6',
              color: C.text2,
            }}
          >
            {aiSummary}
          </div>
        </div>
      )}

      {/* Actions */}
      {onAdjustWaterfall && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 24,
          }}
        >
          <button
            onClick={onAdjustWaterfall}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              color: C.text2,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            ← Adjust waterfall
          </button>
        </div>
      )}
    </div>
  );
}
