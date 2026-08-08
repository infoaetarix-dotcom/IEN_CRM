'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signIn, type LoginState } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, isPending] = useActionState(signIn, initial);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-tenant-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button
        type="submit"
        className="w-full bg-tenant-accent text-white hover:bg-tenant-accent/90"
        disabled={isPending}
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
