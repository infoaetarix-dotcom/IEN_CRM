'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import {
  archiveLead,
  unarchiveLead,
  deleteLead,
  getRenderedLeadTemplate,
  sendCustomLeadEmail,
} from '@/app/(admin)/leads/actions';
import { Button } from '@/components/ui/button';
import { SendWhatsAppDialog } from '@/components/dashboard/send-whatsapp-dialog';
import { SendEmailDialog } from '@/components/dashboard/send-email-dialog';
import { CopyUploadLinkButton } from '@/components/dashboard/applications/copy-upload-link-button';

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onOk?: () => void,
  ) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
      else if (onOk) onOk();
      else router.refresh();
    });
  };
  return { pending, error, run, router };
}

/** Archive/Restore + (admin) permanent-delete controls for the lead detail page. */
export function LeadActions({
  leadId,
  isArchived,
  canArchive,
  canDelete,
}: {
  leadId: string;
  isArchived: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const { pending, error, run, router } = useRun();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      {canArchive &&
        (isArchived ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => unarchiveLead(leadId))}
          >
            <ArchiveRestore className="mr-2 h-4 w-4" /> Restore lead
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => archiveLead(leadId))}
          >
            <Archive className="mr-2 h-4 w-4" /> Archive lead
          </Button>
        ))}

      {canDelete && (
        <div className="border-t border-tenant-ink/10 pt-3">
          {!confirming ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete permanently
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                This permanently deletes the lead and all its notes, history, and
                messages. It cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(() => deleteLead(leadId), () => router.push('/leads'))
                  }
                >
                  {pending ? 'Deleting…' : 'Yes, delete'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Edit / WhatsApp / Email / Delete controls for a row in the active-leads
 * list. Any active org member may use all of these (shared-data model) —
 * Edit navigates via the router instead of a real <a href>, so hovering the
 * button doesn't preview the lead's raw UUID in the browser's status bar.
 */
export function LeadRowActions({
  leadId,
  fullName,
  email,
  phone,
  templates,
  signatures,
  uploadUrl,
  uploadExpired,
}: {
  leadId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  templates: { key: string; name: string; subject: string; body: string }[];
  signatures: { id: string; title: string; body_html: string; is_default: boolean; profile_id: string | null }[];
  uploadUrl: string;
  uploadExpired: boolean;
}) {
  const { pending, error, run, router } = useRun();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-lg border border-tenant-accent/20 bg-tenant-accent/10 text-tenant-accent hover:bg-tenant-accent/20 hover:text-tenant-accent"
        title="Edit"
        disabled={pending}
        onClick={() => router.push(`/leads/${leadId}`)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <SendWhatsAppDialog name={fullName} phone={phone} />
      <SendEmailDialog
        name={fullName}
        email={email}
        templates={templates}
        signatures={signatures}
        resolveTemplate={(templateKey) => getRenderedLeadTemplate(leadId, templateKey)}
        sendAction={(payload) => sendCustomLeadEmail(leadId, payload)}
      />
      <CopyUploadLinkButton url={uploadUrl} expired={uploadExpired} entity="lead" />
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
            onClick={() => run(() => deleteLead(leadId))}
          >
            {pending ? 'Deleting…' : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/** Inline Restore button for rows in the archived-leads list. */
export function RestoreLeadButton({ leadId }: { leadId: string }) {
  const { pending, error, run } = useRun();
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => unarchiveLead(leadId))}
      >
        {pending ? 'Restoring…' : 'Restore'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
