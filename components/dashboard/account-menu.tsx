'use client';

import Link from 'next/link';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';

/** Account chip in the admin navbar — one click for role, email, password reset, and sign out. */
export function AccountMenu({
  fullName,
  email,
  role,
  initials,
}: {
  fullName: string;
  email: string | null;
  role: 'admin' | 'agent';
  initials: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-2 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:pr-3"
        >
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gradient-to-br from-tenant-accent to-tenant-accent2 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-tenant-offwhite sm:inline">
            {fullName}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-tenant-offwhite/60 sm:inline" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
          {email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>}
          <span
            className={cn(
              'mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
              role === 'admin'
                ? 'bg-tenant-accent/15 text-tenant-accent'
                : 'bg-secondary text-secondary-foreground',
            )}
          >
            {role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound className="h-4 w-4" /> Reset password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-red-600 data-[highlighted]:bg-red-50">
          <form action={signOut} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
