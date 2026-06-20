'use client';

import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}
