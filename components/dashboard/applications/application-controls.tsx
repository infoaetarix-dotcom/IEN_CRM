'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import {
  updateApplicationStatus,
  deleteApplication,
  addApplicationNote,
  getRenderedApplicationTemplate,
  sendCustomApplicationEmail,
} from '@/app/(admin)/applications/actions';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SendWhatsAppDialog } from '@/components/dashboard/send-whatsapp-dialog';
import { SendEmailDialog } from '@/components/dashboard/send-email-dialog';
import { CopyUploadLinkButton } from '@/components/dashboard/applications/copy-upload-link-button';
import { LEAD_STATUSES, STATUS_LABELS } from '@/lib/leads/display';

/**
 * Edit / WhatsApp / Email / Copy upload link / Delete for a row in the
 * applications list — same inline-confirm pattern as LeadRowActions on
 * /leads, so the two tables behave identically.
 */
export function ApplicationRowActions({
  applicationId,
  fullName,
  email,
  phone,
  templates,
  uploadUrl,
  uploadExpired,
}: {
  applicationId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  templates: { key: string; name: string; subject: string; body: string }[];
  uploadUrl: string;
  uploadExpired: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-lg border border-tenant-accent/20 bg-tenant-accent/10 text-tenant-accent hover:bg-tenant-accent/20 hover:text-tenant-accent"
        title="Edit"
        disabled={pending}
        onClick={() => router.push(`/applications/${applicationId}`)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <SendWhatsAppDialog name={fullName} phone={phone} />
      <SendEmailDialog
        name={fullName}
        email={email}
        templates={templates}
        resolveTemplate={(templateKey) => getRenderedApplicationTemplate(applicationId, templateKey)}
        sendAction={(payload) => sendCustomApplicationEmail(applicationId, payload)}
      />
      <CopyUploadLinkButton url={uploadUrl} expired={uploadExpired} />
      {!confirming ? (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-600"
          title="Delete"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const res = await deleteApplication(applicationId);
                if (!res.ok) {
                  setError(res.error ?? 'Could not delete this application.');
                  setConfirming(false);
                } else {
                  router.refresh();
                }
              });
            }}
          >
            {pending ? 'Deleting…' : 'Confirm'}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function ApplicationStatusChanger({
  applicationId,
  current,
}: {
  applicationId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Select
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          start(async () => {
            const res = await updateApplicationStatus(applicationId, e.target.value);
            if (!res.ok) setError(res.error ?? 'Something went wrong.');
            else router.refresh();
          });
        }}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ApplicationNoteComposer({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note… (visible to staff only)"
        rows={3}
        disabled={pending}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        size="sm"
        disabled={pending || !body.trim()}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await addApplicationNote(applicationId, body);
            if (!res.ok) setError(res.error ?? 'Could not add note.');
            else {
              setBody('');
              router.refresh();
            }
          });
        }}
      >
        {pending ? 'Saving…' : 'Add note'}
      </Button>
    </div>
  );
}

export function DeleteApplicationButton({
  applicationId,
  leadId,
}: {
  applicationId: string;
  leadId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/5"
        disabled={pending}
        onClick={() => {
          if (!confirm('Delete this application? This cannot be undone.')) return;
          setError(null);
          start(async () => {
            const res = await deleteApplication(applicationId);
            if (!res.ok) setError(res.error ?? 'Could not delete this application.');
            else router.push(`/leads/${leadId}`);
          });
        }}
      >
        {pending ? 'Deleting…' : 'Delete application'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
