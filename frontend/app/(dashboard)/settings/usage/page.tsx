'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { addToast } from '@/components/ui/toast';

interface UsageData {
  period: { start: string; end: string };
  summary: {
    total_companies: number;
    total_field_lookups: number;
    cache_hits: number;
    cache_hit_rate: number;
    serper_calls: number;
    jina_fetches: number;
    deepseek_calls: number;
    haiku_calls: number;
    total_cost_usd: number;
    cost_breakdown: {
      serper_usd: number;
      jina_usd: number;
      deepseek_usd: number;
      haiku_usd: number;
    };
  };
  metering: {
    credits_used: number;
    credits_included: number;
    credits_remaining: number;
    overage_credits: number;
    overage_cost_usd: number;
    projected_monthly_cost: number;
    projected_bill_usd: number;
  };
  by_model: {
    deepseek: { calls: number; cost_usd: number };
    haiku: { calls: number; cost_usd: number };
    cache: { hits: number };
  };
  recent: Array<{
    domain: string;
    fields_enriched: number;
    cost_usd: number;
    model_used: string;
    cache_hit: boolean;
    created_at: string;
  }>;
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'current_month' | 'last_month' | 'last_7_days'>('current_month');

  useEffect(() => {
    fetchUsage();
  }, [period]);

  async function fetchUsage() {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/refyne-search?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch usage');
      const usage = await res.json();
      setData(usage);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
      addToast('error', 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 14, color: C.text2 }}>Loading usage data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 14, color: C.text2 }}>No usage data available</div>
      </div>
    );
  }

  const { summary, metering, by_model, recent } = data;
  const totalModelCalls = by_model.deepseek.calls + by_model.haiku.calls + by_model.cache.hits;
  const deepseekPct = totalModelCalls > 0 ? (by_model.deepseek.calls / totalModelCalls) * 100 : 0;
  const haikuPct = totalModelCalls > 0 ? (by_model.haiku.calls / totalModelCalls) * 100 : 0;
  const cachePct = totalModelCalls > 0 ? (by_model.cache.hits / totalModelCalls) * 100 : 0;

  const isOverage = metering.credits_used > metering.credits_included;

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: F.sans }}>
            ENRICHMENT USAGE
          </h1>
          <div style={{ fontSize: 13, color: C.text3 }}>
            Track Refyne Search enrichment costs and API usage
          </div>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            borderRadius: 0,
            cursor: 'pointer',
            fontFamily: F.sans,
          }}
        >
          <option value="current_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="last_7_days">Last 7 days</option>
        </select>
      </div>

      {/* Top metrics cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <MetricCard
          label="Credits used"
          value={`${metering.credits_used.toLocaleString()} / ${metering.credits_included.toLocaleString()}`}
          subtext={isOverage ? `${metering.overage_credits} over limit` : `${metering.credits_remaining} remaining`}
          color={isOverage ? C.red : C.text}
        />
        <MetricCard
          label="Real cost"
          value={`$${summary.total_cost_usd.toFixed(2)}`}
          subtext="this period"
          color={C.text}
        />
        <MetricCard
          label="Cache hit rate"
          value={`${(summary.cache_hit_rate * 100).toFixed(0)}%`}
          subtext={`${summary.cache_hits} hits`}
          color={C.text}
        />
        <MetricCard
          label="Projected bill"
          value={`$${metering.projected_bill_usd.toFixed(2)}`}
          subtext={period === 'current_month' ? 'end of month' : 'for period'}
          color={metering.projected_bill_usd > 0 ? C.amber : C.text}
        />
      </div>

      {/* Credit usage bar */}
      {isOverage && (
        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${C.red}`,
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: C.red, marginBottom: 8 }}>
            ⚠️ Credit limit exceeded
          </div>
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 12 }}>
            You've used {metering.overage_credits} credits over your plan limit. Overage charges: $
            {metering.overage_cost_usd.toFixed(2)} ($0.012/credit)
          </div>
          {/* Progress bar */}
          <div style={{ height: 24, background: C.border, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${Math.min(100, (metering.credits_included / metering.credits_used) * 100)}%`,
                background: C.indigo,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(100, (metering.credits_included / metering.credits_used) * 100)}%`,
                top: 0,
                height: '100%',
                width: `${Math.min(100, (metering.overage_credits / metering.credits_used) * 100)}%`,
                background: C.red,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 8,
                top: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                fontSize: 11,
                fontWeight: 500,
                color: 'white',
              }}
            >
              {metering.credits_used.toLocaleString()} / {metering.credits_included.toLocaleString()} credits
            </div>
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: F.sans }}>
          COST BREAKDOWN
        </h2>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
          <CostRow label="Serper searches" value={`${summary.serper_calls} calls`} cost={summary.cost_breakdown.serper_usd} />
          <CostRow
            label="Jina page fetches"
            value={`${summary.jina_fetches} fetches`}
            cost={summary.cost_breakdown.jina_usd}
            note="free tier"
          />
          <CostRow
            label="DeepSeek (primary)"
            value={`${by_model.deepseek.calls} calls`}
            cost={summary.cost_breakdown.deepseek_usd}
          />
          <CostRow
            label="Haiku (fallback)"
            value={`${by_model.haiku.calls} calls`}
            cost={summary.cost_breakdown.haiku_usd}
          />
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
            <CostRow label="Total" value="" cost={summary.total_cost_usd} bold />
          </div>
        </div>
      </div>

      {/* Model usage */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: F.sans }}>
          MODEL USAGE
        </h2>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ height: 40, display: 'flex', marginBottom: 16 }}>
            {deepseekPct > 0 && (
              <div
                style={{
                  width: `${deepseekPct}%`,
                  background: C.indigo,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'white',
                  fontWeight: 500,
                }}
              >
                {deepseekPct >= 15 && `DeepSeek ${deepseekPct.toFixed(0)}%`}
              </div>
            )}
            {haikuPct > 0 && (
              <div
                style={{
                  width: `${haikuPct}%`,
                  background: C.amber,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'white',
                  fontWeight: 500,
                }}
              >
                {haikuPct >= 15 && `Haiku ${haikuPct.toFixed(0)}%`}
              </div>
            )}
            {cachePct > 0 && (
              <div
                style={{
                  width: `${cachePct}%`,
                  background: C.text3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'white',
                  fontWeight: 500,
                }}
              >
                {cachePct >= 15 && `Cache ${cachePct.toFixed(0)}%`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12, color: C.text2 }}>
            <div>
              <span style={{ color: C.indigo, marginRight: 4 }}>●</span>
              DeepSeek: {by_model.deepseek.calls} calls
            </div>
            <div>
              <span style={{ color: C.amber, marginRight: 4 }}>●</span>
              Haiku: {by_model.haiku.calls} calls
            </div>
            <div>
              <span style={{ color: C.text3, marginRight: 4 }}>●</span>
              Cache: {by_model.cache.hits} hits
            </div>
          </div>
        </div>
      </div>

      {/* Recent enrichments */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: F.sans }}>
          RECENT ENRICHMENTS
        </h2>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 500,
              color: C.text3,
              textTransform: 'uppercase',
            }}
          >
            <div>Domain</div>
            <div>Fields</div>
            <div>Model</div>
            <div>Cost</div>
            <div>Cached</div>
          </div>

          {/* Rows */}
          {recent.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '12px 16px',
                borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
                fontSize: 13,
                color: C.text,
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.domain}</div>
              <div>{item.fields_enriched}</div>
              <div style={{ textTransform: 'capitalize' }}>{item.model_used}</div>
              <div>${item.cost_usd.toFixed(4)}</div>
              <div>{item.cache_hit ? 'Yes' : 'No'}</div>
            </div>
          ))}

          {recent.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: C.text3 }}>
              No enrichments yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string;
  subtext: string;
  color: string;
}) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, textTransform: 'uppercase', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color, marginBottom: 4, fontFamily: F.sans }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.text3 }}>{subtext}</div>
    </div>
  );
}

function CostRow({
  label,
  value,
  cost,
  note,
  bold,
}: {
  label: string;
  value: string;
  cost: number;
  note?: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        fontSize: 13,
        color: C.text,
        fontWeight: bold ? 500 : 400,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{label}</span>
        {value && <span style={{ fontSize: 12, color: C.text3 }}>{value}</span>}
        {note && (
          <span style={{ fontSize: 11, color: C.text3, fontStyle: 'italic' }}>({note})</span>
        )}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
        ${cost.toFixed(2)}
      </div>
    </div>
  );
}
