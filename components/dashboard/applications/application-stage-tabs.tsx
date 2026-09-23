'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, type ApplicationStage } from '@/lib/leads/display';

/**
 * In-page stage tabs for /applications — filters the table by pipeline
 * stage (Application / Fee Deposit / Visa / Enrolled) via a `stage` query
 * param, same pattern as LeadsFilters. Lives in the page content, not the
 * sidebar: this is a view into one page's data, not a new section of the app.
 */
export function ApplicationStageTabs({
  counts,
  total,
}: {
  counts: Record<ApplicationStage, number>;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = params.get('stage') ?? '';

  function go(stage: string) {
    const next = new URLSearchParams(params.toString());
    if (stage) next.set('stage', stage);
    else next.delete('stage');
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-tenant-ink/10 pb-3">
      <TabButton active={active === ''} onClick={() => go('')}>
        All ({total})
      </TabButton>
      {APPLICATION_STAGES.map((stage) => (
        <TabButton key={stage} active={active === stage} onClick={() => go(stage)}>
          {APPLICATION_STAGE_LABELS[stage]} ({counts[stage] ?? 0})
        </TabButton>
      ))}
      {pending && <span className="text-xs text-muted-foreground">Updating…</span>}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-tenant-accent text-white'
          : 'bg-tenant-gray text-tenant-ink hover:bg-tenant-ink/10',
      )}
    >
      {children}
    </button>
  );
}
