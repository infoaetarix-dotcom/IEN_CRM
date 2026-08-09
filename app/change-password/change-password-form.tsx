'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from './actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await changePassword(password, confirm);
      if (!res.ok) {
        setError(res.error ?? 'Could not change password.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Update password'}
        </Button>
        {!forced && (
          <a
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            Cancel
          </a>
        )}
      </div>
    </form>
  );
}
