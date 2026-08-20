'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { uploadDocument, replaceDocument, deleteDocument } from '@/app/(admin)/applications/actions';
import { Button } from '@/components/ui/button';
import type { ApplicationDocument } from '@/lib/applications/types';

function formatBytes(n: number | null): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await uploadDocument(applicationId, formData);
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

function ReplaceButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const formData = new FormData();
          formData.set('file', file);
          setError(null);
          start(async () => {
            const res = await replaceDocument(documentId, formData);
            if (!res.ok) setError(res.error ?? 'Could not replace this file.');
            else router.refresh();
          });
          e.target.value = '';
        }}
      />
      <button
        type="button"
        title="Replace"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink disabled:opacity-50"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}

export function DocumentsPanel({
  applicationId,
  documents,
}: {
  applicationId: string;
  documents: ApplicationDocument[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setDeletingId(id);
    start(async () => {
      await deleteDocument(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <UploadForm applicationId={applicationId} />
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
                {d.uploaded_by_student && (
                  <span className="ml-2 rounded-full bg-tenant-accent2/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-tenant-accent2">
                    From student
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1">
              <a
                href={`/api/applications/documents/${d.id}`}
                title="Download"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <ReplaceButton documentId={d.id} />
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
