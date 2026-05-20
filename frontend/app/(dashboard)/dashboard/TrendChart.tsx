'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ReferenceLine } from 'recharts';
import { C, F } from '@/lib/design-tokens';

interface TrendChartProps {
  data: Array<{ m: string; v: number; date?: string; event?: string }>;
  benchmark?: number;
}

type Period = '7d' | '30d' | '90d';

export function TrendChart({ data, benchmark }: TrendChartProps) {
  const [period, setPeriod] = useState<Period>('30d');

  // Load period from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('refyne:score-trend-period');
    if (saved && ['7d', '30d', '90d'].includes(saved)) {
      setPeriod(saved as Period);
    }
  }, []);

  // Save period to localStorage when changed
  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    localStorage.setItem('refyne:score-trend-period', newPeriod);
  };

  // Filter data based on period (approximate by data points)
  const getFilteredData = () => {
    const pointsMap: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const points = pointsMap[period];
    return data.slice(-Math.ceil(points / 7)); // Assuming weekly data points
  };

  const filteredData = getFilteredData();

  // Calculate Y-axis domain and ticks
  const values = filteredData.map(d => d.v);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const currentValue = values[values.length - 1];
  const startingValue = values[0];

  // Y-axis should show: 100%, current, starting, 70%
  const yMin = Math.max(0, Math.floor((minValue - 5) / 10) * 10);
  const yMax = 100;
  const yTicks = [yMin, startingValue, currentValue, yMax].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b);

  // Custom tooltip with delta
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const idx = filteredData.findIndex((d) => d === point);
      const prevPoint = idx > 0 ? filteredData[idx - 1] : null;
      const delta = prevPoint ? point.v - prevPoint.v : 0;

      return (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text, marginBottom: 4 }}>
            {point.date || point.m} — {point.v}%
          </div>
          {delta !== 0 && (
            <div style={{ fontSize: 10, color: delta > 0 ? C.green : C.red, fontFamily: F.mono }}>
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}pts from previous
            </div>
          )}
          {point.event && (
            <div style={{ fontSize: 10, color: C.text3 }}>
              {point.event}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              style={{
                padding: '4px 8px',
                background: period === p ? C.indigo : 'transparent',
                border: `1px solid ${period === p ? C.indigo : C.border2}`,
                borderRadius: 4,
                color: period === p ? '#fff' : C.text3,
                fontSize: 10,
                fontFamily: F.mono,
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={filteredData} margin={{ left: 10, right: 10 }}>
          <defs>
            <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.indigo} stopOpacity={0.2} />
              <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="m"
            tick={{ fill: C.text3, fontSize: 10, fontFamily: F.mono }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            ticks={yTicks.length > 1 ? yTicks : [yMin, yMax]}
            tick={{ fill: C.text3, fontSize: 10, fontFamily: F.mono }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Benchmark line */}
          {benchmark && (
            <ReferenceLine
              y={benchmark}
              stroke={C.text3}
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: `Similar portals avg: ${benchmark}%`,
                position: 'insideTopRight',
                fill: C.text3,
                fontSize: 9,
                fontFamily: F.mono,
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="v"
            stroke={C.indigo}
            strokeWidth={2}
            fill="url(#ig)"
            dot={{ fill: C.indigo, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
