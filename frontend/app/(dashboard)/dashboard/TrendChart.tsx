'use client';

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { C, F } from '@/lib/design-tokens';

interface TrendChartProps {
  data: Array<{ m: string; v: number }>;
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data}>
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
        <Tooltip
          contentStyle={{
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 8,
            color: C.text,
            fontSize: 11,
            fontFamily: F.mono,
          }}
          cursor={{ stroke: C.border2, strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={C.indigo}
          strokeWidth={1.5}
          fill="url(#ig)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
