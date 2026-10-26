'use client';

import { useRef, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CountryField } from '@/components/form/country-field';
import { createUniversity } from '@/app/(admin)/settings/actions';
import type { University } from '@/lib/universities/types';

/**
 * Compact "add a university" form for use inside another popup (e.g. Create
 * application), so a missing university doesn't mean a detour to Settings.
 * Same server action — and so the same validation, audit log and duplicate
 * check — as Settings > Universities.
 *
 * Deliberately not a <form>: it can sit inside a parent form, and nested
 * forms are invalid HTML. The fields are read from this wrapper on save.
 */
export function InlineAddUniversity({
  defaultName = '',
  onCreated,
  onCancel,
}: {
  defaultName?: string;
  onCreated: (university: University) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSave() {
    const wrapper = ref.current;
    if (!wrapper) return;
    const fd = new FormData();
    for (const el of wrapper.querySelectorAll<HTMLInputElement>('input[name]')) {
      fd.set(el.name, el.value);
    }
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await createUniversity({ ok: false }, fd);
      if (!res.ok || !res.university) {
        setError(res.error ?? 'Could not save this university.');
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      onCreated(res.university);
    });
  }

  return (
    <div
      ref={ref}
      className="space-y-4 rounded-lg border border-tenant-accent/30 bg-tenant-accent/5 p-4"
      onKeyDown={(e) => {
        // Enter in the name box saves, like a normal form would.
        if (e.key === 'Enter' && (e.target as HTMLElement).id === 'inline_university_name') {
          e.preventDefault();
          handleSave();
        }
      }}
    >
      <div>
        <p className="text-sm font-medium text-tenant-ink">Add a new university</p>
        <p className="text-xs text-muted-foreground">
          It&apos;s added to your shared list in Settings and selected here.
        </p>
      </div>
      <div>
        <Label htmlFor="inline_university_name">University name</Label>
        <Input
          id="inline_university_name"
          name="name"
          defaultValue={defaultName}
          placeholder="e.g. University of Toronto"
          autoFocus
          className="bg-white"
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
      </div>
      <div>
        <Label>Country</Label>
        <div className="mt-1.5">
          <CountryField name="country" defaultCountry="GB" error={fieldErrors.country} />
        </div>
      </div>
      {error && !fieldErrors.name && !fieldErrors.country && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          disabled={pending}
          className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
          onClick={handleSave}
        >
          {pending ? 'Saving…' : 'Add university'}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
