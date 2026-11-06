'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/**
 * "Export" on /leads and /applications: pick a date range and a format,
 * then download every record in that range (whole days in the org's time
 * zone). The list's other filters are only applied if asked, so
 * "everything from 1 to 31 October" is the default.
 */
export function ExportDialog({
  endpoint,
  noun,
  dateVerb,
  filterKeys,
  todayKey,
  extraParams = {},
}: {
  /** e.g. /api/leads/export */
  endpoint: string;
  /** "leads" / "applications" — used in the wording. */
  noun: string;
  /** "received" / "created" — what the dates refer to. */
  dateVerb: string;
  /** The list page's own URL filter keys, offered as "match current filters". */
  filterKeys: string[];
  todayKey: string;
  /** Always sent (e.g. archived=1 on the archived leads view). */
  extraParams?: Record<string, string>;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [withFilters, setWithFilters] = useState(false);
  const activeFilters = filterKeys.filter((k) => params.get(k));

  const invalid = !!from && !!to && from > to;
  const href = (() => {
    const q = new URLSearchParams(extraParams);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (format === 'csv') q.set('format', 'csv');
    if (withFilters) for (const k of activeFilters) q.set(k, params.get(k)!);
    return `${endpoint}?${q.toString()}`;
  })();

  const quick = (label: string, f: string, t: string) => (
    <button
      type="button"
      onClick={() => {
        setFrom(f);
        setTo(t);
      }}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        from === f && to === t
          ? 'border-tenant-accent bg-tenant-accent text-white'
          : 'border-tenant-ink/15 text-tenant-ink hover:bg-tenant-gray',
      )}
    >
      {label}
    </button>
  );
  const monthStart = `${todayKey.slice(0, 7)}-01`;
  const lastMonthEnd = new Date(Date.parse(`${monthStart}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Start from the list's own date filter, if it has one.
          setFrom(params.get('from') ?? '');
          setTo(params.get('to') ?? '');
          setWithFilters(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Export {noun}</DialogTitle>
          <DialogDescription>
            Download all {noun} {dateVerb} between two dates. Leave a date empty for no limit on that side.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {quick('This month', monthStart, todayKey)}
            {quick('Last month', lastMonthStart, lastMonthEnd)}
            {quick('All time', '', '')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="export_from">From</Label>
              <Input id="export_from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="export_to">To</Label>
              <Input id="export_to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          {invalid && <p className="text-sm text-destructive">“From” must be on or before “To”.</p>}

          <div>
            <p className="text-sm font-medium text-tenant-ink">Format</p>
            <div className="mt-1.5 flex gap-4 text-sm">
              {(['xlsx', 'csv'] as const).map((f) => (
                <label key={f} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="export_format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="accent-accent"
                  />
                  {f === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)'}
                </label>
              ))}
            </div>
          </div>

          {activeFilters.length > 0 && (
            <label className="flex items-start gap-2 text-sm text-tenant-ink">
              <Checkbox checked={withFilters} onChange={(e) => setWithFilters(e.target.checked)} className="mt-0.5" />
              Only {noun} matching the list’s current filters too
            </label>
          )}

          <a
            href={invalid ? undefined : href}
            aria-disabled={invalid}
            onClick={() => !invalid && setOpen(false)}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-md bg-tenant-accent px-4 text-sm font-medium text-white hover:bg-tenant-accent/90',
              invalid && 'pointer-events-none opacity-50',
            )}
          >
            <Download className="h-4 w-4" /> Download {format === 'csv' ? 'CSV' : 'Excel'}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
