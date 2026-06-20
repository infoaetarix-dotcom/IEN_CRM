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

const ACCENT = '#C8872E';
const NAVY = '#0A1A2F';
const GRID = 'rgba(11,31,51,0.08)';

interface Datum {
  label: string;
  value: number;
}

export function SourceBar({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(200,135,46,0.08)' }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={ACCENT} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIPELINE_COLORS: Record<string, string> = {
  New: '#0ea5e9',
  Contacted: '#C8872E',
  'In progress': '#f59e0b',
  Accepted: '#10b981',
  Rejected: '#ef4444',
  'Follow-up': '#64748b',
};

export function PipelineBar({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(11,31,51,0.05)' }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={PIPELINE_COLORS[d.label] ?? NAVY} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VolumeLine({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: '#6B7A8D' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={NAVY}
          strokeWidth={2}
          dot={{ r: 2, fill: NAVY }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
