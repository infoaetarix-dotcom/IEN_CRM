'use client';

import { useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LEAD_STATUSES, STATUS_LABELS, LEAD_SOURCES, SOURCE_LABELS } from '@/lib/leads/display';
import { FollowUpFilter } from '@/components/dashboard/follow-ups/follow-up-filter';
import { INTAKE_SEASONS, INTAKE_YEARS } from '@/lib/form-options';
import { FilterPanel, FilterSearch } from '@/components/dashboard/filter-panel';
import { cn } from '@/lib/utils';

/** Staff option for the "created by" filter. */
export interface StaffOption {
  id: string;
  name: string;
}

const FILTER_KEYS = ['q', 'status', 'source', 'completeness', 'staff', 'followup', 'season', 'year', 'from', 'to'];

/**
 * Every filter a dashboard or report link can set is visible (and editable)
 * here, so a shortened list always shows why. Selects follow the URL rather
 * than keeping their first value, so arriving from such a link updates them.
 */
export function LeadsFilters({ staff = [] }: { staff?: StaffOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page'); // reset to first page on any filter change
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));
  const clearHref = params.get('archived') === '1' ? `${pathname}?archived=1` : pathname;

  // "q" is the search box, which stays visible; the badge counts the rest.
  const activeCount = FILTER_KEYS.filter((k) => k !== 'q' && params.get(k)).length;
  const cell = 'w-full sm:w-auto';

  return (
    <FilterPanel
      activeCount={activeCount}
      search={
        // debounce-lite: push on each change; transitions keep it smooth
        <FilterSearch
          value={params.get('q') ?? ''}
          onSearch={(v) => setParam('q', v)}
          label="Search leads"
          placeholder="Search name, email, phone…"
        />
      }
    >
      <Select
        value={params.get('status') ?? ''}
        aria-label="Status"
        className={cn(cell, 'sm:w-[160px]')}
        onChange={(e) => setParam('status', e.target.value)}
      >
        <option value="">All statuses</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={params.get('source') ?? ''}
        aria-label="Source"
        className={cn(cell, 'sm:w-[150px]')}
        onChange={(e) => setParam('source', e.target.value)}
      >
        <option value="">All sources</option>
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={params.get('completeness') ?? ''}
        aria-label="Completeness"
        className={cn(cell, 'sm:w-[160px]')}
        onChange={(e) => setParam('completeness', e.target.value)}
      >
        <option value="">All applications</option>
        <option value="complete">Completed</option>
        <option value="incomplete">Incomplete only</option>
      </Select>

      {staff.length > 0 && (
        <Select
          value={params.get('staff') ?? ''}
          aria-label="Created by"
          className={cn(cell, 'sm:w-[170px]')}
          onChange={(e) => setParam('staff', e.target.value)}
        >
          <option value="">Created by anyone</option>
          <option value="none">Public form</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}

      <FollowUpFilter className={cn(cell, 'sm:w-[190px]')} />

      <Select
        value={params.get('season') ?? ''}
        aria-label="Intake"
        className={cn(cell, 'sm:w-[140px]')}
        onChange={(e) => setParam('season', e.target.value)}
      >
        <option value="">Any intake</option>
        {INTAKE_SEASONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
        <option value="__none">Intake not set</option>
      </Select>
      <Select
        value={params.get('year') ?? ''}
        aria-label="Intake year"
        className={cn(cell, 'sm:w-[110px]')}
        onChange={(e) => setParam('year', e.target.value)}
      >
        <option value="">Any year</option>
        {[...new Set([...INTAKE_YEARS, ...(params.get('year') ? [Number(params.get('year'))] : [])])]
          .sort((a, b) => a - b)
          .map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
      </Select>

      <div className="col-span-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span className="col-span-3 sm:col-span-1">Received</span>
        <Input
          type="date"
          aria-label="Received from"
          value={params.get('from') ?? ''}
          className="min-w-0 sm:w-[150px]"
          onChange={(e) => setParam('from', e.target.value)}
        />
        to
        <Input
          type="date"
          aria-label="Received to"
          value={params.get('to') ?? ''}
          className="min-w-0 sm:w-[150px]"
          onChange={(e) => setParam('to', e.target.value)}
        />
      </div>

      {hasFilters && (
        <Link
          href={clearHref}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-md px-2 text-sm text-tenant-accent hover:underline sm:justify-start"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </Link>
      )}

      {isPending && <span className="col-span-2 text-xs text-muted-foreground">Updating…</span>}
    </FilterPanel>
  );
}
