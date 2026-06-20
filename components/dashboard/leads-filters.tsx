'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LEAD_STATUSES, STATUS_LABELS, LEAD_SOURCES, SOURCE_LABELS } from '@/lib/leads/display';

interface AgentOption {
  id: string;
  full_name: string;
}

export function LeadsFilters({
  agents,
  showAgentFilter,
}: {
  agents: AgentOption[];
  showAgentFilter: boolean;
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
      next.delete('page'); // reset to first page on any filter change
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

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
        defaultValue={params.get('status') ?? ''}
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
        defaultValue={params.get('source') ?? ''}
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

      {showAgentFilter && (
        <Select
          defaultValue={params.get('agent') ?? ''}
          className="w-[170px]"
          onChange={(e) => setParam('agent', e.target.value)}
        >
          <option value="">All agents</option>
          <option value="unassigned">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </Select>
      )}

      {isPending && (
        <span className="text-xs text-muted-foreground">Updating…</span>
      )}
    </div>
  );
}
