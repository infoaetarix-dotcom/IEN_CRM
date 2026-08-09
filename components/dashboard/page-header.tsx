import type { LucideIcon } from 'lucide-react';

/**
 * Icon + title card used at the top of every admin/agent list page (Dashboard,
 * Leads, Agents, Templates) — the shared "portal" header pattern.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-tenant-accent to-tenant-accent2 text-white shadow-sm">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-tenant-display text-2xl font-semibold text-tenant-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-tenant-ink/60">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
