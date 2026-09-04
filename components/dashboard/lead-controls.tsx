'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateLeadStatus,
  addNote,
  getRenderedLeadTemplate,
  sendCustomLeadEmail,
} from '@/app/(admin)/leads/actions';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LEAD_STATUSES, STATUS_LABELS } from '@/lib/leads/display';
import { SendEmailDialog } from '@/components/dashboard/send-email-dialog';

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
      else router.refresh();
    });
  };
  return { pending, error, run };
}

export function StatusChanger({
  leadId,
  current,
}: {
  leadId: string;
  current: string;
}) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-1">
      <Select
        defaultValue={current}
        disabled={pending}
        onChange={(e) => run(() => updateLeadStatus(leadId, e.target.value))}
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

export function NoteComposer({ leadId }: { leadId: string }) {
  const { pending, error, run } = useAction();
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
        onClick={() =>
          run(async () => {
            const res = await addNote(leadId, body);
            if (res.ok) setBody('');
            return res;
          })
        }
      >
        {pending ? 'Saving…' : 'Add note'}
      </Button>
    </div>
  );
}

type Signature = { id: string; title: string; body_html: string; is_default: boolean; profile_id: string | null };

/**
 * Client-side wrapper around SendEmailDialog for the lead detail page.
 * Server actions must be called from client code, not passed as closures
 * from a Server Component prop — this component takes plain, serializable
 * props (leadId etc.) and builds the resolveTemplate/sendAction callbacks
 * itself, same as LeadRowActions already does for the leads table.
 */
export function LeadCustomEmailButton({
  leadId,
  name,
  email,
  templates,
  signatures,
}: {
  leadId: string;
  name: string;
  email: string | null;
  templates: { key: string; name: string; subject: string; body: string }[];
  signatures: Signature[];
}) {
  return (
    <SendEmailDialog
      name={name}
      email={email}
      templates={templates}
      signatures={signatures}
      resolveTemplate={(templateKey) => getRenderedLeadTemplate(leadId, templateKey)}
      sendAction={(payload) => sendCustomLeadEmail(leadId, payload)}
    />
  );
}
