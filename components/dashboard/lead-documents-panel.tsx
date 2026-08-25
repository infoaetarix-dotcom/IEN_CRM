'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Upload } from 'lucide-react';
import { uploadLeadDocument, deleteLeadDocument } from '@/app/(admin)/leads/actions';
import { Button } from '@/components/ui/button';
import type { LeadDocument } from '@/lib/leads/types';

function formatBytes(n: number | null): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await uploadLeadDocument(leadId, formData);
      if (!res.ok) {
        setError(res.error ?? 'Could not upload the file.');
      } else {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="file"
        accept="application/pdf,image/png,image/jpeg"
        required
        disabled={pending}
        className="text-sm"
      />
      <Button type="submit" size="sm" disabled={pending}>
        <Upload className="mr-1 h-4 w-4" /> {pending ? 'Uploading…' : 'Upload'}
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </form>
  );
}

/** Mirrors DocumentsPanel (components/dashboard/applications/documents-panel.tsx) for the parallel lead_documents system — no Replace control, since leads' documents actions don't expose one. */
export function LeadDocumentsPanel({
  leadId,
  documents,
}: {
  leadId: string;
  documents: LeadDocument[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setDeletingId(id);
    start(async () => {
      await deleteLeadDocument(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <UploadForm leadId={leadId} />
      <div className="space-y-2">
        {documents.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
        {documents.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-md border border-tenant-ink/10 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{d.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(d.file_size)} · {new Date(d.created_at).toLocaleDateString('en-GB')}
                {d.uploaded_by_lead && (
                  <span className="ml-2 rounded-full bg-tenant-accent2/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-tenant-accent2">
                    From lead
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1">
              <a
                href={`/api/leads/documents/${d.id}`}
                title="Download"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                title="Delete"
                disabled={pending && deletingId === d.id}
                onClick={() => handleDelete(d.id)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
