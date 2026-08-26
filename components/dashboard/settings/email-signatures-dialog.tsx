'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, Pencil, Trash2, Star } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { deleteEmailSignature, setDefaultSignature } from '@/app/(admin)/settings/actions';
import { SignatureFormDialog } from './signature-form-dialog';
import type { EmailSignature } from '@/lib/email/types';

/**
 * Settings > Email signatures tile — opens a popup with every signature in
 * the org (personal + shared), matching UniversitiesDialog's pattern.
 * Any admin or agent can edit/delete any row here (shared-data model, same
 * as Universities) — profile_id is shown as an owner label, not used to
 * gate the Edit/Delete buttons themselves.
 */
export function EmailSignaturesDialog({
  signatures,
  profiles,
  currentProfileId,
}: {
  signatures: EmailSignature[];
  profiles: { id: string; full_name: string }[];
  currentProfileId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));

  function ownerLabel(s: EmailSignature): string {
    if (!s.profile_id) return 'Shared';
    if (s.profile_id === currentProfileId) return 'You';
    return nameById.get(s.profile_id) ?? 'Someone';
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this signature? This cannot be undone.')) return;
    setError(null);
    setBusyId(id);
    start(async () => {
      const res = await deleteEmailSignature(id);
      if (!res.ok) setError(res.error ?? 'Could not delete this signature.');
      router.refresh();
    });
  }

  function handleSetDefault(id: string) {
    setError(null);
    setBusyId(id);
    start(async () => {
      const res = await setDefaultSignature(id);
      if (!res.ok) setError(res.error ?? 'Could not update the default.');
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
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <p className="font-tenant-display text-base font-semibold text-tenant-ink">
              Email signatures
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Personal and shared signatures your team can use when sending —{' '}
              {signatures.length} saved.
            </p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Email signatures</DialogTitle>
          <DialogDescription>
            Personal signatures are your own; Shared (&ldquo;Common&rdquo;) ones are usable by
            everyone, including automated emails.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <SignatureFormDialog />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {signatures.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No signatures yet — add your first one above.
            </p>
          )}
          {signatures.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-tenant-ink/10 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-tenant-ink">{s.title}</p>
                  {s.is_default && <Badge variant="success">Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{ownerLabel(s)}</p>
              </div>
              <div className="flex flex-none items-center gap-1">
                {!s.is_default && (
                  <button
                    type="button"
                    title="Set as default"
                    disabled={pending && busyId === s.id}
                    onClick={() => handleSetDefault(s.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <SignatureFormDialog
                  signature={s}
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
                  disabled={pending && busyId === s.id}
                  onClick={() => handleDelete(s.id)}
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
