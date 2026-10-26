'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { FOLLOW_UP_FILTERS, FOLLOW_UP_FILTER_LABELS } from '@/lib/follow-ups/status';

/** "Follow-up: Today / Overdue / This week / Any" — the ?followup= filter on /leads and /applications. */
export function FollowUpFilter({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  return (
    <Select
      aria-label="Follow-up"
      value={params.get('followup') ?? ''}
      className={className}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set('followup', e.target.value);
        else next.delete('followup');
        next.delete('page');
        start(() => router.push(`${pathname}?${next.toString()}`));
      }}
    >
      <option value="">All follow-ups</option>
      {FOLLOW_UP_FILTERS.map((f) => (
        <option key={f} value={f}>
          {FOLLOW_UP_FILTER_LABELS[f]}
        </option>
      ))}
    </Select>
  );
}
