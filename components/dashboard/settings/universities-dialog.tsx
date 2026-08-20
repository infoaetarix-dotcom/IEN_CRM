'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { deleteUniversity } from '@/app/(admin)/settings/actions';
import { UniversityFormDialog } from './university-form-dialog';
import type { University } from '@/lib/universities/types';

/**
 * Settings > Universities tile — opens a popup with the org's full list
 * (add/edit/delete, shared between admin and agent) rather than navigating
 * to a separate page.
 */
export function UniversitiesDialog({ universities }: { universities: University[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this university? This cannot be undone.')) return;
    setError(null);
    setDeletingId(id);
    start(async () => {
      const res = await deleteUniversity(id);
      if (!res.ok) setError(res.error ?? 'Could not delete this university.');
      router.refresh();
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-4 rounded-xl border border-tenant-ink/10 bg-white p-5 text-left shadow-sm transition-colors hover:border-tenant-accent hover:bg-tenant-gray"
        >
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-tenant-accent/10 text-tenant-accent">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-tenant-display text-base font-semibold text-tenant-ink">
              Universities
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the list your team picks from when creating an application —{' '}
              {universities.length} listed.
            </p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Universities</DialogTitle>
          <DialogDescription>
            Shared with your whole team — every admin and agent can add, edit, or delete entries.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <UniversityFormDialog />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {universities.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No universities yet — add your first one above.
            </p>
          )}
          {universities.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-tenant-ink/10 p-3"
            >
              <div>
                <p className="text-sm font-medium text-tenant-ink">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.country}</p>
              </div>
              <div className="flex items-center gap-1">
                <UniversityFormDialog
                  university={u}
                  trigger={
                    <button
                      type="button"
                      title="Edit"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  }
                />
                <button
                  type="button"
                  title="Delete"
                  disabled={pending && deletingId === u.id}
                  onClick={() => handleDelete(u.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
