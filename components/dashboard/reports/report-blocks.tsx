import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Presentational pieces for Settings → Reports. Every number that can be
 * opened as a list is a link to the leads / applications page filtered to
 * exactly what it counts.
 */

export function StatCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  href?: string;
  tone?: 'bad' | 'good';
}) {
  const body = (
    <Card
      className={cn(
        'h-full rounded-xl border-tenant-ink/10 shadow-sm',
        href && 'transition-colors group-hover:border-tenant-accent/40 group-hover:bg-tenant-accent/[0.03]',
      )}
    >
      <CardContent className="p-4">
        <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-tenant-accent">
          {label}
          {href && <ArrowUpRight className="h-3.5 w-3.5 flex-none opacity-0 transition-opacity group-hover:opacity-100" />}
        </p>
        <p
          className={cn(
            'mt-1.5 font-tenant-display text-2xl font-semibold text-tenant-ink',
            tone === 'bad' && 'text-red-600',
            tone === 'good' && 'text-emerald-600',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-accent">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('rounded-xl border-tenant-ink/10 shadow-sm', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="font-tenant-display text-base">{title}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** A ranked list of counts with a proportional bar; each row opens its list. */
export function CountList({
  rows,
  empty = 'Nothing to show.',
}: {
  rows: { label: string; count: number; href?: string; muted?: boolean }[];
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const inner = (
          <>
            <span className={cn('min-w-0 flex-1 truncate', r.muted && 'text-muted-foreground')}>{r.label}</span>
            <span className="relative hidden h-1.5 w-28 overflow-hidden rounded-full bg-tenant-gray sm:block">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-tenant-accent"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="w-10 text-right font-medium tabular-nums text-tenant-ink">{r.count}</span>
          </>
        );
        return (
          <li key={r.label}>
            {r.href && r.count > 0 ? (
              <Link href={r.href} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-tenant-accent/5">
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-2 py-1.5 text-sm">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Simple data table whose first column links to the filtered list. */
export function ReportTable({
  columns,
  rows,
  empty = 'Nothing to show.',
}: {
  columns: string[];
  rows: { key: string; cells: (string | number)[]; href?: string }[];
  empty?: string;
}) {
  if (!rows.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tenant-ink/10 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c, i) => (
              <th key={c} className={cn('px-2 py-2 font-medium', i > 0 && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-tenant-ink/5 last:border-0">
              {r.cells.map((c, i) => (
                <td key={i} className={cn('px-2 py-2', i > 0 && 'text-right tabular-nums')}>
                  {i === 0 && r.href ? (
                    <Link href={r.href} className="text-tenant-accent hover:underline">
                      {c}
                    </Link>
                  ) : (
                    c
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
