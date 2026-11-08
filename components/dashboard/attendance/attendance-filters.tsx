'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

/** Agent + date range for /attendance's history. Everything lives in the URL. */
export function AttendanceFilters({
  agents,
  from,
  to,
  agent,
}: {
  agents: { id: string; name: string }[];
  from: string;
  to: string;
  agent: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.push(`${pathname}?${next.toString()}`));
  }

  const hasFilters = ['agent', 'from', 'to'].some((k) => params.get(k));

  return (
    <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <Select
        aria-label="Agent"
        value={agent}
        className="col-span-2 w-full sm:w-[200px]"
        onChange={(e) => set('agent', e.target.value)}
      >
        <option value="">All agents</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        aria-label="From"
        value={from}
        max={to}
        className="min-w-0 sm:w-[160px]"
        onChange={(e) => set('from', e.target.value)}
      />
      <Input
        type="date"
        aria-label="To"
        value={to}
        min={from}
        className="min-w-0 sm:w-[160px]"
        onChange={(e) => set('to', e.target.value)}
      />
      {hasFilters && (
        <Link
          href={pathname}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1 px-2 text-sm text-tenant-accent hover:underline sm:justify-start"
        >
          <X className="h-3.5 w-3.5" /> This month
        </Link>
      )}
      {pending && <span className="col-span-2 text-xs text-muted-foreground">Updating…</span>}
    </div>
  );
}
