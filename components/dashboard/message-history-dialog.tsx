'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export interface HistoryMessage {
  id: string;
  subject: string | null;
  body: string | null;
  /** True for the rich text compose box's output; false/legacy is plain text. */
  body_is_html: boolean | null;
  status: string;
  template_key: string | null;
  sent_by: string | null;
  created_at: string;
  error_detail: string | null;
  /** The signature attached when it was sent (embedded via messages.signature_id). */
  email_signatures?: { body_html: string } | { body_html: string }[] | null;
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "See previous email" trigger + popup — the full content of every email
 * ever sent to this lead, not just the subject line the inline history card
 * shows. Read-only; nothing here sends anything.
 */
export function MessageHistoryDialog({
  messages,
  nameById,
  emailById,
}: {
  messages: HistoryMessage[];
  nameById: Map<string, string | null>;
  emailById: Map<string, string | null>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-tenant-accent2/20 bg-tenant-accent2/10 px-2.5 py-1 text-xs font-medium text-tenant-accent2 transition-colors hover:bg-tenant-accent2/20"
        >
          <History className="h-3.5 w-3.5" /> See previous email
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">
            Email history
          </DialogTitle>
          <DialogDescription>
            Every email sent to this student, most recent first — shown as it was sent.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
          )}
          {messages.map((m) => {
            const senderName = m.sent_by ? (nameById.get(m.sent_by) ?? 'Staff') : 'System';
            const senderEmail = m.sent_by ? emailById.get(m.sent_by) : null;
            const sig = Array.isArray(m.email_signatures) ? m.email_signatures[0] : m.email_signatures;
            const signature = sig?.body_html || null;
            return (
              <div key={m.id} className="rounded-lg border border-tenant-ink/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm text-tenant-ink">
                    {m.subject || m.template_key || '(no subject)'}
                  </p>
                  <Badge
                    variant={
                      m.status === 'sent'
                        ? 'success'
                        : m.status === 'failed'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {m.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Emailed by {senderName}
                  {senderEmail ? ` (${senderEmail})` : ''} · {fmtDateTime(m.created_at)}
                </p>
                {(m.body || signature) && (
                  // Rendered like the sent email itself (see .email-content):
                  // same font, spacing and bullets, signature underneath.
                  <div className="email-content mt-2 rounded-md border border-tenant-ink/10 bg-white p-4">
                    {m.body &&
                      (m.body_is_html ? (
                        <div
                          // Rich text compose output, not raw client input —
                          // the editor's own schema restricts it to a small
                          // safe tag set (bold/italic/underline/color/links/
                          // lists), the same trust boundary already used for
                          // signature HTML.
                          dangerouslySetInnerHTML={{ __html: m.body }}
                        />
                      ) : (
                        // Plain text was sent HTML-escaped with newlines as
                        // <br/>; pre-wrap shows it the same way.
                        <div className="whitespace-pre-wrap">{m.body}</div>
                      ))}
                    {signature && (
                      <div
                        style={{ marginTop: 20 }}
                        // Sanitised when saved (lib/email/signatures.ts).
                        dangerouslySetInnerHTML={{ __html: signature }}
                      />
                    )}
                  </div>
                )}
                {m.error_detail && (
                  <p className="mt-2 text-xs text-destructive">{m.error_detail}</p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
