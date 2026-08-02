'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, type ResetRequestState } from './actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const initial: ResetRequestState = { ok: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.ok) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we&rsquo;ve sent a link to reset
          your password. Check your inbox (and spam folder).
        </p>
        <Link href="/login" className="text-sm text-accent hover:underline">
          &larr; Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus />
      </div>
      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
      <Link
        href="/login"
        className="block text-sm text-muted-foreground hover:underline"
      >
        &larr; Back to sign in
      </Link>
    </form>
  );
}
