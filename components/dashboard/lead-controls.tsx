'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateLeadStatus,
  addNote,
  assignLead,
  sendLeadEmail,
} from '@/app/(admin)/leads/actions';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LEAD_STATUSES, STATUS_LABELS } from '@/lib/leads/display';

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

export function AssignControl({
  leadId,
  current,
  agents,
}: {
  leadId: string;
  current: string | null;
  agents: { id: string; full_name: string }[];
}) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-1">
      <Select
        defaultValue={current ?? ''}
        disabled={pending}
        onChange={(e) =>
          run(() => assignLead(leadId, e.target.value || null))
        }
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.full_name}
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

export function EmailPanel({
  leadId,
  templates,
}: {
  leadId: string;
  templates: { key: string; name: string; subject: string; body: string }[];
  leadVars?: Record<string, string | null>;
}) {
  const { pending, error, run } = useAction();
  const [key, setKey] = useState(templates[0]?.key ?? '');
  const [sent, setSent] = useState(false);
  const selected = templates.find((t) => t.key === key);

  return (
    <div className="space-y-3">
      <Select
        value={key}
        disabled={pending}
        onChange={(e) => {
          setKey(e.target.value);
          setSent(false);
        }}
      >
        {templates.map((t) => (
          <option key={t.key} value={t.key}>
            {t.name}
          </option>
        ))}
      </Select>

      {selected && (
        <div className="rounded-md border border-line bg-secondary/30 p-3 text-sm">
          <p className="font-medium">{selected.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {selected.body}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Variables like {'{{full_name}}'} are filled in when sent.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {sent && !error && (
        <p className="text-xs text-emerald-700">Email sent and logged.</p>
      )}

      <Button
        size="sm"
        variant="accent"
        disabled={pending || !key}
        onClick={() =>
          run(async () => {
            const res = await sendLeadEmail(leadId, key);
            if (res.ok) setSent(true);
            return res;
          })
        }
      >
        {pending ? 'Sending…' : 'Send email'}
      </Button>
    </div>
  );
}
