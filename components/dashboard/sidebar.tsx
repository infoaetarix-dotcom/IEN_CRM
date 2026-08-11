'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Mail,
  Link2,
  Wallet,
  Activity,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Only shown when this key is in the org's enabled modules — opt-in features. */
  moduleKey?: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/agents', label: 'Agents', icon: UserCog, adminOnly: true },
  { href: '/templates', label: 'Templates', icon: Mail, adminOnly: true },
  { href: '/form', label: 'Form', icon: Link2 },
  { href: '/finance', label: 'Finance', icon: Wallet, adminOnly: true, moduleKey: 'finance' },
  {
    href: '/activity',
    label: 'Activity',
    icon: Activity,
    adminOnly: true,
    moduleKey: 'activity_tracker',
  },
];

export function Sidebar({
  role,
  enabledModules = [],
  orientation = 'vertical',
}: {
  role: 'admin' | 'agent';
  /** Module keys enabled for this org (see organization_modules). */
  enabledModules?: string[];
  orientation?: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => {
    if (i.adminOnly && role !== 'admin') return false;
    if (i.moduleKey && !enabledModules.includes(i.moduleKey)) return false;
    return true;
  });

  return (
    <nav
      className={cn(
        'flex gap-1',
        orientation === 'vertical'
          ? 'flex-col items-center p-3'
          // More tabs than fit should scroll horizontally, not shrink or
          // wrap — items below are flex-none so they keep their size, and
          // min-w-0 is what actually lets a flex child shrink enough for
          // overflow-x-auto to kick in instead of pushing the row wider
          // than the viewport.
          : 'min-w-0 flex-1 items-center overflow-x-auto px-3',
      )}
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={cn(
              'flex h-11 w-11 flex-none items-center justify-center rounded-lg transition-colors',
              active
                ? 'bg-tenant-accent text-white'
                : 'text-tenant-offwhite/70 hover:bg-white/10 hover:text-tenant-offwhite',
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}
    </nav>
  );
}
