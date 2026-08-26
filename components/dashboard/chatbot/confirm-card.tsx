'use client';

import { useState, useTransition } from 'react';
import { confirmChatbotAction, cancelChatbotAction } from '@/app/(admin)/chatbot/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/**
 * Shown for a drafted email or WhatsApp message — never sends by itself.
 * Confirming/cancelling calls a plain button-triggered server action; the
 * model has no way to reach either. WhatsApp has no server-side send
 * capability in this codebase, so its "confirm" just opens the same wa.me
 * link the manual send button uses, then records that it was actioned.
 */
export function ConfirmCard({
  messageId,
  tool,
  draft,
  onDone,
}: {
  messageId: string;
  tool: string;
  draft: Record<string, unknown>;
  onDone: () => void;
}) {
  const isEmail = tool === 'draft_and_send_email';
  const [to, setTo] = useState(typeof draft.to === 'string' ? draft.to : '');
  const [subject, setSubject] = useState(typeof draft.subject === 'string' ? draft.subject : '');
  const [body, setBody] = useState(typeof draft.body === 'string' ? draft.body : '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    start(async () => {
      if (!isEmail) {
        const digits = to.replace(/[^\d]/g, '');
        if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
      }
      const res = await confirmChatbotAction(messageId, { to, subject, body });
      if (!res.ok) {
        setError(res.error ?? 'Could not send.');
        return;
      }
      onDone();
    });
  }

  function cancel() {
    start(async () => {
      await cancelChatbotAction(messageId);
      onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-tenant-accent/30 bg-tenant-accent/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-tenant-accent">
        {isEmail ? 'Confirm email' : 'Confirm WhatsApp message'}
      </p>
      <div>
        <Label htmlFor={`confirm-to-${messageId}`} className="text-xs">To</Label>
        <Input id={`confirm-to-${messageId}`} value={to} onChange={(e) => setTo(e.target.value)} disabled={pending} className="h-8 text-sm" />
      </div>
      {isEmail && (
        <div>
          <Label htmlFor={`confirm-subject-${messageId}`} className="text-xs">Subject</Label>
          <Input id={`confirm-subject-${messageId}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={pending} className="h-8 text-sm" />
        </div>
      )}
      <div>
        <Label htmlFor={`confirm-body-${messageId}`} className="text-xs">Message</Label>
        <Textarea id={`confirm-body-${messageId}`} value={body} onChange={(e) => setBody(e.target.value)} disabled={pending} rows={4} className="text-sm" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={send}
          disabled={pending || !to.trim() || !body.trim()}
          className="bg-tenant-accent text-white hover:opacity-90"
        >
          {pending ? 'Sending…' : isEmail ? 'Send email' : 'Open WhatsApp'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
