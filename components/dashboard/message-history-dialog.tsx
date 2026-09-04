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
  status: string;
  template_key: string | null;
  sent_by: string | null;
  created_at: string;
  error_detail: string | null;
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
            Every email sent to this lead, most recent first.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
          )}
          {messages.map((m) => {
            const senderName = m.sent_by ? (nameById.get(m.sent_by) ?? 'Staff') : 'System';
            const senderEmail = m.sent_by ? emailById.get(m.sent_by) : null;
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
                {m.body && (
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-tenant-gray p-2.5 text-sm text-tenant-ink">
                    {m.body}
                  </p>
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
