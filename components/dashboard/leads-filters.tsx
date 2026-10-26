'use client';

import { useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LEAD_STATUSES, STATUS_LABELS, LEAD_SOURCES, SOURCE_LABELS } from '@/lib/leads/display';

/** Staff option for the "created by" filter. */
export interface StaffOption {
  id: string;
  name: string;
}

const FILTER_KEYS = ['q', 'status', 'source', 'completeness', 'staff', 'from', 'to'];

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

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={params.get('q') ?? ''}
          placeholder="Search name, email, phone…"
          className="pl-9"
          onChange={(e) => {
            const v = e.target.value;
            // debounce-lite: push on each change; transitions keep it smooth
            setParam('q', v);
          }}
        />
      </div>

      <Select
        value={params.get('status') ?? ''}
        aria-label="Status"
        className="w-[160px]"
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
        className="w-[150px]"
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
        className="w-[160px]"
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
          className="w-[170px]"
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

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Received
        <Input
          type="date"
          aria-label="Received from"
          value={params.get('from') ?? ''}
          className="w-[150px]"
          onChange={(e) => setParam('from', e.target.value)}
        />
        to
        <Input
          type="date"
          aria-label="Received to"
          value={params.get('to') ?? ''}
          className="w-[150px]"
          onChange={(e) => setParam('to', e.target.value)}
        />
      </div>

      {hasFilters && (
        <Link
          href={clearHref}
          className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-tenant-accent hover:underline"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </Link>
      )}

      {isPending && (
        <span className="text-xs text-muted-foreground">Updating…</span>
      )}
    </div>
  );
}
