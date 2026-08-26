'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateLeadStatus,
  addNote,
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

/** Personal default first, then the shared default, then nothing selected. */
function defaultSignatureId(signatures: Signature[]): string {
  const personal = signatures.find((s) => s.profile_id !== null && s.is_default);
  if (personal) return personal.id;
  const shared = signatures.find((s) => s.profile_id === null && s.is_default);
  return shared?.id ?? '';
}

export function EmailPanel({
  leadId,
  templates,
  signatures = [],
}: {
  leadId: string;
  templates: { key: string; name: string; subject: string; body: string }[];
  signatures?: Signature[];
  leadVars?: Record<string, string | null>;
}) {
  const { pending, error, run } = useAction();
  const [key, setKey] = useState(templates[0]?.key ?? '');
  const [signatureId, setSignatureId] = useState(() => defaultSignatureId(signatures));
  const [sent, setSent] = useState(false);
  const selected = templates.find((t) => t.key === key);
  const personalSignatures = signatures.filter((s) => s.profile_id !== null);
  const sharedSignatures = signatures.filter((s) => s.profile_id === null);

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

      {signatures.length > 0 && (
        <Select
          value={signatureId}
          disabled={pending}
          onChange={(e) => setSignatureId(e.target.value)}
        >
          <option value="">No signature</option>
          {personalSignatures.length > 0 && (
            <optgroup label="Your signatures">
              {personalSignatures.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </optgroup>
          )}
          {sharedSignatures.length > 0 && (
            <optgroup label="Shared">
              {sharedSignatures.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </optgroup>
          )}
        </Select>
      )}

      {selected && (
        <div className="rounded-md border border-tenant-ink/10 bg-tenant-gray p-3 text-sm">
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
        className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
        disabled={pending || !key}
        onClick={() =>
          run(async () => {
            const res = await sendLeadEmail(leadId, key, signatureId || null);
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
