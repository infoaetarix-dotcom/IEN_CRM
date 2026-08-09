'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOrganization,
  type SuperResult,
} from '@/app/super/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { THEME_LIST, DEFAULT_THEME_KEY } from '@/lib/branding/themes';

const initial: SuperResult = { ok: false };

export function CreateOrgForm({
  modules,
  defaultModules,
}: {
  modules: { key: string; name: string }[];
  defaultModules: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createOrganization, initial);
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
        <Button className="bg-marketing-blue text-white hover:bg-marketing-blue/90">
          + New consultancy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marketing-ink">New consultancy</DialogTitle>
          <DialogDescription>
            Provision a tenant — organization, package, and their first admin login.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Consultancy name *</Label>
              <Input id="name" name="name" placeholder="e.g. Acme Study Abroad" required />
            </div>
            <div>
              <Label htmlFor="slug">URL slug *</Label>
              <Input id="slug" name="slug" placeholder="acme" required />
              <p className="mt-1 text-xs text-muted-foreground">
                Their form link: /<span className="font-mono">slug</span>/apply
              </p>
            </div>
          </div>

          <div className="rounded-md border border-marketing-ink/10 bg-marketing-gray p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
              First admin (their login)
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="admin_name">Name *</Label>
                <Input id="admin_name" name="admin_name" required />
              </div>
              <div>
                <Label htmlFor="admin_email">Email *</Label>
                <Input id="admin_email" name="admin_email" type="email" required />
              </div>
              <div>
                <Label htmlFor="admin_password">Temp password *</Label>
                <Input id="admin_password" name="admin_password" type="text" minLength={8} required />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="theme_key">Color theme</Label>
            <Select id="theme_key" name="theme_key" defaultValue={DEFAULT_THEME_KEY}>
              {THEME_LIST.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Applies to their admin panel, login, and password pages. Changeable later.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
              Package — enabled modules
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name="modules"
                    value={m.key}
                    defaultChecked={defaultModules.includes(m.key)}
                    className="accent-marketing-blue text-marketing-blue"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-marketing-blue text-white hover:bg-marketing-blue/90"
              disabled={pending}
            >
              {pending ? 'Creating…' : 'Create consultancy'}
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
