'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAgent,
  setAgentActive,
  setAgentRole,
  type AgentActionResult,
} from '@/app/(admin)/agents/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const initial: AgentActionResult = { ok: false };

export function CreateAgentForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createAgent, initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="accent" size="sm">
        Add staff member
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2"
    >
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="text" minLength={8} required />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="agent">
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      {state.error && (
        <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending} variant="accent" size="sm">
          {pending ? 'Creating…' : 'Create'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AgentRowControls({
  id,
  role,
  isActive,
  isSelf,
}: {
  id: string;
  role: 'admin' | 'agent';
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<AgentActionResult>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Error');
      else router.refresh();
    });
  };

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        defaultValue={role}
        disabled={pending}
        className="h-8 w-[110px]"
        onChange={(e) =>
          run(() => setAgentRole(id, e.target.value as 'admin' | 'agent'))
        }
      >
        <option value="agent">Agent</option>
        <option value="admin">Admin</option>
      </Select>
      <Button
        size="sm"
        variant={isActive ? 'outline' : 'accent'}
        disabled={pending}
        onClick={() => run(() => setAgentActive(id, !isActive))}
      >
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
