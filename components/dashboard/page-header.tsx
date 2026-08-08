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
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-marketing-blue to-marketing-cyan text-white shadow-sm">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-marketing-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-marketing-ink/60">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
