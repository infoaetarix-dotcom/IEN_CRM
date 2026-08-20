'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CountryField } from '@/components/form/country-field';
import {
  createUniversity,
  updateUniversity,
  type SettingsActionState,
} from '@/app/(admin)/settings/actions';
import type { University } from '@/lib/universities/types';

const init: SettingsActionState = { ok: false };

/** Add (default trigger) or edit (pass an existing university + custom trigger) a university. */
export function UniversityFormDialog({
  university,
  trigger,
}: {
  university?: University;
  trigger?: ReactNode;
}) {
  const isEdit = !!university;
  const action = isEdit ? updateUniversity.bind(null, university.id) : createUniversity;
  const [state, formAction, pending] = useActionState(action, init);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90"
          >
            <Plus className="h-4 w-4" /> Add university
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">
            {isEdit ? 'Edit university' : 'Add university'}
          </DialogTitle>
          <DialogDescription>
            Shared with your whole team — every admin and agent can use and manage this list.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="university_name">University name</Label>
            <Input
              id="university_name"
              name="name"
              defaultValue={university?.name}
              placeholder="e.g. University of Toronto"
              required
            />
            {state.fieldErrors?.name && (
              <p className="mt-1 text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>
          <div>
            <Label>Country</Label>
            <div className="mt-1.5">
              <CountryField
                name="country"
                defaultCountryName={university?.country}
                defaultCountry={university ? null : 'GB'}
                error={state.fieldErrors?.country}
              />
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
              disabled={pending}
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add university'}
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
