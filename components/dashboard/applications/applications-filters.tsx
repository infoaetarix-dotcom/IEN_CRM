'use client';

import { useCallback, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  APPLICATION_STAGES,
  APPLICATION_STAGE_LABELS,
  APPLICATION_STATUSES_BY_STAGE,
  APPLICATION_STATUS_LABELS,
} from '@/lib/leads/display';
import { INTAKE_SEASONS, INTAKE_YEARS } from '@/lib/form-options';
import { NONE } from '@/lib/applications/list-filters';
import { FollowUpFilter } from '@/components/dashboard/follow-ups/follow-up-filter';
import { FilterPanel, FilterSearch } from '@/components/dashboard/filter-panel';
import { cn } from '@/lib/utils';

const FILTER_KEYS = ['q', 'statuses', 'university', 'country', 'season', 'year', 'staff', 'from', 'to', 'followup', 'label'];

/**
 * Search + filters for /applications — the counterpart of LeadsFilters.
 * Everything lives in the URL (same keys the intake report's links use),
 * and selects follow the URL so arriving from a report shows its filters.
 */
export function ApplicationsFilters({
  universities,
  countries,
  staff,
  years,
}: {
  universities: string[];
  countries: string[];
  staff: { id: string; name: string }[];
  /** Intake years to offer — the standard range plus any already used. */
  years: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // Changing anything by hand ends the "from the report" description.
      next.delete('label');
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  const statuses = params.get('statuses') ?? '';
  const multiStatus = statuses.includes(',');
  const hasFilters = FILTER_KEYS.some((k) => params.get(k));
  const yearOptions = [...new Set([...INTAKE_YEARS, ...years])].sort((a, b) => a - b);

  // The search box stays visible; the badge counts the rest ("label" is
  // just a report's description, not a filter).
  const activeCount = FILTER_KEYS.filter((k) => k !== 'q' && k !== 'label' && params.get(k)).length;
  const cell = 'w-full sm:w-auto';

  return (
    <FilterPanel
      activeCount={activeCount}
      search={
        <FilterSearch
          key={params.get('q') === null ? 'empty' : 'q'}
          value={params.get('q') ?? ''}
          onSearch={(v) => setParam('q', v)}
          label="Search applications"
          placeholder="Search name, email, phone, application # or passport…"
        />
      }
    >
      <Select
        aria-label="Status"
        value={multiStatus ? '__report' : statuses}
        className={cn(cell, 'col-span-2 sm:w-[200px]')}
        onChange={(e) => setParam('statuses', e.target.value === '__report' ? statuses : e.target.value)}
      >
        <option value="">All statuses</option>
        {multiStatus && <option value="__report">Several (from report)</option>}
        {APPLICATION_STAGES.map((stage) => (
          <optgroup key={stage} label={APPLICATION_STAGE_LABELS[stage]}>
            {APPLICATION_STATUSES_BY_STAGE[stage].map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      <Select
        aria-label="University"
        value={params.get('university') ?? ''}
        className={cn(cell, 'sm:w-[200px]')}
        onChange={(e) => setParam('university', e.target.value)}
      >
        <option value="">All universities</option>
        {universities.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        <option value={NONE}>No university</option>
      </Select>

      <Select
        aria-label="Country"
        value={params.get('country') ?? ''}
        className={cn(cell, 'sm:w-[160px]')}
        onChange={(e) => setParam('country', e.target.value)}
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Intake"
        value={params.get('season') ?? ''}
        className={cn(cell, 'sm:w-[140px]')}
        onChange={(e) => setParam('season', e.target.value)}
      >
        <option value="">Any intake</option>
        {INTAKE_SEASONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
        <option value={NONE}>Intake not set</option>
      </Select>
      <Select
        aria-label="Intake year"
        value={params.get('year') ?? ''}
        className={cn(cell, 'sm:w-[110px]')}
        onChange={(e) => setParam('year', e.target.value)}
      >
        <option value="">Any year</option>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>

      {staff.length > 0 && (
        <Select
          aria-label="Created by"
          value={params.get('staff') ?? ''}
          className={cn(cell, 'sm:w-[170px]')}
          onChange={(e) => setParam('staff', e.target.value)}
        >
          <option value="">Created by anyone</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}

      <FollowUpFilter className={cn(cell, 'sm:w-[190px]')} />

      <div className="col-span-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span className="col-span-3 sm:col-span-1">Created</span>
        <Input
          type="date"
          aria-label="Created from"
          value={params.get('from') ?? ''}
          className="min-w-0 sm:w-[150px]"
          onChange={(e) => setParam('from', e.target.value)}
        />
        to
        <Input
          type="date"
          aria-label="Created to"
          value={params.get('to') ?? ''}
          className="min-w-0 sm:w-[150px]"
          onChange={(e) => setParam('to', e.target.value)}
        />
      </div>

      {hasFilters && (
        <Link
          href={pathname}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-sm text-tenant-accent hover:underline sm:justify-start"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </Link>
      )}

      {isPending && <span className="col-span-2 text-xs text-muted-foreground">Updating…</span>}
    </FilterPanel>
  );
}
