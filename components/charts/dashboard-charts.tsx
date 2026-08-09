'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

// Fallback hex if a chart is ever rendered without a theme prop — matches
// the 'aetarix-default' theme in lib/branding/themes.ts.
const DEFAULT_ACCENT = '#2563EB';
const DEFAULT_NAVY = '#0B1220';
const GRID = 'rgba(17,24,39,0.08)';
const TICK = { fontSize: 12, fill: '#6B7A8D' };

interface Datum {
  label: string;
  value: number;
}

export function SourceBar({ data, accent = DEFAULT_ACCENT }: { data: Datum[]; accent?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: `${accent}14` }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={accent} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Categorical pipeline-stage colors — "Contacted" tracks the org's accent. */
function pipelineColors(accent: string, navy: string): Record<string, string> {
  return {
    New: '#0ea5e9',
    Contacted: accent,
    'In progress': '#f59e0b',
    Accepted: '#10b981',
    Rejected: '#ef4444',
    'Follow-up': '#64748b',
    __default: navy,
  };
}

export function PipelineBar({
  data,
  accent = DEFAULT_ACCENT,
  navy = DEFAULT_NAVY,
}: {
  data: Datum[];
  accent?: string;
  navy?: string;
}) {
  const colors = pipelineColors(accent, navy);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ ...TICK, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(17,24,39,0.05)' }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={colors[d.label] ?? colors.__default} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VolumeLine({ data, navy = DEFAULT_NAVY }: { data: Datum[]; navy?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ ...TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={navy}
          strokeWidth={2}
          dot={{ r: 2, fill: navy }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
