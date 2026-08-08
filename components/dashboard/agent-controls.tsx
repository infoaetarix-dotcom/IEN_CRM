'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAgent,
  setAgentActive,
  type AgentActionResult,
} from '@/app/(admin)/agents/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-tenant-accent text-white hover:bg-tenant-accent/90">
          Add staff member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">
            Add staff member
          </DialogTitle>
          <DialogDescription>
            They&rsquo;ll sign in with this email and temporary password, then set
            their own on first login.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
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
          {state.error && (
            <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={pending}
              className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
            >
              {pending ? 'Creating…' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AgentRowControls({
  id,
  isActive,
  isSelf,
}: {
  id: string;
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
      <Button
        size="sm"
        variant={isActive ? 'outline' : undefined}
        className={!isActive ? 'bg-tenant-accent text-white hover:bg-tenant-accent/90' : undefined}
        disabled={pending}
        onClick={() => run(() => setAgentActive(id, !isActive))}
      >
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
