'use client';

import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';

export function SignOutButton({
  iconOnly = false,
  className,
}: {
  /** Render just the icon (with a title/aria-label) — no visible "Sign out" text. */
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        title="Sign out"
        aria-label={iconOnly ? 'Sign out' : undefined}
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
          className,
        )}
      >
        <LogOut className="h-4 w-4" />
        {!iconOnly && 'Sign out'}
      </button>
    </form>
  );
}
