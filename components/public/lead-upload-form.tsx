'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload } from 'lucide-react';
import { uploadLeadDocumentPublic } from '@/app/(public)/upload/lead/actions';
import { Button } from '@/components/ui/button';

interface DocumentRow {
  id: string;
  file_name: string;
  created_at: string;
}

/**
 * Add-only dropzone for the public /upload/lead/[token] page — mirrors
 * StudentUploadForm (components/public/student-upload-form.tsx) exactly;
 * kept as a separate component rather than a shared one so the two upload
 * flows (leads vs. applications) can diverge freely later without risking
 * each other.
 */
export function LeadUploadForm({
  token,
  initialDocuments,
}: {
  token: string;
  initialDocuments: DocumentRow[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file');
    setError(null);
    setJustUploaded(null);
    start(async () => {
      const res = await uploadLeadDocumentPublic(token, formData);
      if (!res.ok) {
        setError(res.error ?? 'Could not upload the file.');
        return;
      }
      if (file instanceof File) {
        setDocuments((prev) => [
          { id: `pending-${Date.now()}`, file_name: file.name, created_at: new Date().toISOString() },
          ...prev,
        ]);
        setJustUploaded(file.name);
      }
      formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-tenant-ink/10 bg-white p-6">
        <p className="label-eyebrow">Add a document</p>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-3 flex flex-wrap items-center gap-3"
        >
          <input
            type="file"
            name="file"
            accept="application/pdf,image/png,image/jpeg"
            required
            disabled={pending}
            className="text-sm"
          />
          <Button
            type="submit"
            disabled={pending}
            className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
          >
            <Upload className="mr-2 h-4 w-4" /> {pending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">PDF, PNG, or JPG — up to 10MB.</p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {justUploaded && !error && (
          <p className="mt-2 text-sm text-emerald-700">Uploaded {justUploaded}.</p>
        )}
      </div>

      <div className="rounded-lg border border-tenant-ink/10 bg-white p-6">
        <p className="label-eyebrow">Already submitted</p>
        <div className="mt-3 space-y-2">
          {documents.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          )}
          {documents.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-md border border-tenant-ink/10 px-3 py-2"
            >
              <p className="truncate text-sm">{d.file_name}</p>
              <p className="flex-none text-xs text-muted-foreground">
                {new Date(d.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
