'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
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
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  createEmailSignature,
  updateEmailSignature,
  type SignatureActionState,
} from '@/app/(admin)/settings/actions';
import type { EmailSignature } from '@/lib/email/types';

// Client-only — keeps the ProseMirror/TipTap bundle out of the initial
// /settings page load, fetched only when a signature form actually opens.
const RichTextEditor = dynamic(
  () => import('@/components/dashboard/rich-text-editor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="h-[136px] animate-pulse rounded-md border border-input bg-tenant-gray" /> },
);

const init: SignatureActionState = { ok: false };

/** Add (default trigger) or edit (pass an existing signature + custom trigger) an email signature. */
export function SignatureFormDialog({
  signature,
  trigger,
}: {
  signature?: EmailSignature;
  trigger?: ReactNode;
}) {
  const isEdit = !!signature;
  const action = isEdit ? updateEmailSignature.bind(null, signature.id) : createEmailSignature;
  const [state, formAction, pending] = useActionState(action, init);
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState(signature?.body_html ?? '');
  const [kind, setKind] = useState<'personal' | 'shared'>(signature?.profile_id ? 'personal' : 'shared');

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  // Create mode reuses one component instance across multiple "add"
  // actions — reset the controlled fields each time it's freshly opened.
  useEffect(() => {
    if (open && !isEdit) {
      setHtml('');
      setKind('personal');
    }
  }, [open, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90"
          >
            <Plus className="h-4 w-4" /> Add signature
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">
            {isEdit ? 'Edit signature' : 'Add signature'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "This signature's title and content — anyone who could see it before still can."
              : 'Personal is just for you; Shared ("Common") is usable by your whole team, including automated emails.'}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {!isEdit && (
            <div>
              <Label htmlFor="signature_kind">Type</Label>
              <Select
                id="signature_kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as 'personal' | 'shared')}
              >
                <option value="personal">Personal — just for me</option>
                <option value="shared">Shared — &ldquo;Common&rdquo;, usable by anyone</option>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="signature_title">Title</Label>
            <Input
              id="signature_title"
              name="title"
              defaultValue={signature?.title}
              placeholder="e.g. Formal, Follow-up"
              required
            />
            {state.fieldErrors?.title && (
              <p className="mt-1 text-xs text-destructive">{state.fieldErrors.title}</p>
            )}
          </div>
          <div>
            <Label>Signature</Label>
            <div className="mt-1.5">
              <RichTextEditor value={html} onChange={setHtml} disabled={pending} />
            </div>
            <input type="hidden" name="body_html" value={html} />
            {state.fieldErrors?.body_html && (
              <p className="mt-1 text-xs text-destructive">{state.fieldErrors.body_html}</p>
            )}
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
              disabled={pending}
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add signature'}
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
