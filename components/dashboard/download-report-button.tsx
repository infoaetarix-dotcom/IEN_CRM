'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const RANGES = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_year', label: 'This year' },
  { key: 'all_time', label: 'All time' },
];

/** Date-range picker for a server-generated report — the endpoint reads the caller's own session, nothing here needs org/user props. */
export function DownloadReportButton({
  href,
  label,
}: {
  /** API route to hit, e.g. '/api/finance/statement' — a `?range=` query param is appended. */
  href: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-tenant-ink/10 bg-white px-3 text-sm text-tenant-ink transition-colors hover:bg-tenant-gray"
        >
          <Download className="h-4 w-4" /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {RANGES.map((r) => (
          <a
            key={r.key}
            href={`${href}?range=${r.key}`}
            onClick={() => setOpen(false)}
            className="flex items-center rounded-sm px-2 py-2 text-sm text-foreground hover:bg-secondary"
          >
            {r.label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
