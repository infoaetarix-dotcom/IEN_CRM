'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INTAKE_SEASONS } from '@/lib/form-options';
import type { ReportType } from '@/lib/reports/selection';

/**
 * The one row of controls at the top of Settings → Reports: which report,
 * then which month / period / intake. No tabs — changing a control just
 * changes the URL, so any report view can be bookmarked or shared.
 */
export function ReportPicker({
  type,
  month,
  periods,
  periodId,
  year,
  season,
  years,
  exportHref,
}: {
  type: ReportType;
  /** YYYY-MM, for the monthly report. */
  month: string;
  periods: { id: string; label: string }[];
  periodId: string;
  year: number;
  season: string;
  years: number[];
  exportHref: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go(params: Record<string, string | number>) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== '') q.set(k, String(v));
    start(() => router.push(`/settings/reports?${q.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-tenant-ink/10 bg-white p-4 shadow-sm">
      <div>
        <Label htmlFor="report_type">Report</Label>
        <Select
          id="report_type"
          value={type}
          className="mt-1.5 w-[220px]"
          onChange={(e) => go({ type: e.target.value })}
        >
          <option value="monthly">Monthly — leads</option>
          <option value="period">Reporting period — leads</option>
          <option value="intake">Intake — applications</option>
        </Select>
      </div>

      {type === 'monthly' && (
        <div>
          <Label htmlFor="report_month">Month</Label>
          <Input
            id="report_month"
            type="month"
            value={month}
            className="mt-1.5 w-[180px]"
            onChange={(e) => e.target.value && go({ type, month: e.target.value })}
          />
        </div>
      )}

      {type === 'period' && periods.length > 0 && (
        <>
          <div>
            <Label htmlFor="report_period">Period</Label>
            <Select
              id="report_period"
              value={periodId}
              className="mt-1.5 w-[220px]"
              onChange={(e) => go({ type, period: e.target.value, year })}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <YearSelect years={years} value={year} onChange={(y) => go({ type, period: periodId, year: y })} />
        </>
      )}

      {type === 'intake' && (
        <>
          <div>
            <Label htmlFor="report_season">Intake</Label>
            <Select
              id="report_season"
              value={season}
              className="mt-1.5 w-[160px]"
              onChange={(e) => go({ type, season: e.target.value, year })}
            >
              {INTAKE_SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <YearSelect years={years} value={year} onChange={(y) => go({ type, season, year: y })} />
        </>
      )}

      {exportHref && (
        <a
          href={exportHref}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md border border-tenant-ink/15 px-3 text-sm text-tenant-ink hover:bg-tenant-ink/5"
        >
          <Download className="h-4 w-4" /> Download Excel
        </a>
      )}
      {pending && <span className="text-xs text-muted-foreground">Loading…</span>}
    </div>
  );
}

function YearSelect({ years, value, onChange }: { years: number[]; value: number; onChange: (y: number) => void }) {
  return (
    <div>
      <Label htmlFor="report_year">Year</Label>
      <Select
        id="report_year"
        value={value}
        className="mt-1.5 w-[110px]"
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
