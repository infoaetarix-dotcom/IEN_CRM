'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Mail,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/agents', label: 'Agents', icon: UserCog, adminOnly: true },
  { href: '/templates', label: 'Templates', icon: Mail, adminOnly: true },
  { href: '/form', label: 'Form', icon: Link2 },
];

export function Sidebar({
  role,
  orientation = 'vertical',
}: {
  role: 'admin' | 'agent';
  orientation?: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.adminOnly || role === 'admin');

  return (
    <nav
      className={cn(
        'flex gap-1',
        orientation === 'vertical'
          ? 'flex-col items-center p-3'
          : 'flex-1 items-center justify-around p-2',
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
              'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
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
