'use client';

import { useActionState, useState } from 'react';
import { signIn, type LoginState } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Turnstile } from '@/components/form/turnstile';

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, isPending] = useActionState(signIn, initial);
  const [turnstileToken, setTurnstileToken] = useState('');

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Turnstile onVerify={setTurnstileToken} />
      <Button
        type="submit"
        className="w-full bg-tenant-accent text-white hover:bg-tenant-accent/90"
        disabled={isPending}
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Forgotten your password? Contact your administrator.
      </p>
    </form>
  );
}
