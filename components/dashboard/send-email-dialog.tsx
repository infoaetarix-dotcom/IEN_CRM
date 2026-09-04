'use client';

import { useState, useTransition } from 'react';
import { Mail } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/dashboard/rich-text-editor';
import { isBlankHtml } from '@/lib/utils';

type Template = { key: string; name: string; subject: string; body: string };
type Signature = { id: string; title: string; body_html: string; is_default: boolean; profile_id: string | null };
type ActionResult = { ok: boolean; error?: string };
type TemplateResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; error: string };

/** Personal default first, then the shared default, then nothing selected. */
function defaultSignatureId(signatures: Signature[]): string {
  const personal = signatures.find((s) => s.profile_id !== null && s.is_default);
  if (personal) return personal.id;
  const shared = signatures.find((s) => s.profile_id === null && s.is_default);
  return shared?.id ?? '';
}

/** Give a plain-text template body a reasonable starting shape in the rich text box. */
function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * "Email" trigger + popup, usable from any row (lead or application) that
 * knows a recipient email. Picking a template fetches it pre-rendered with
 * the real person's details (never raw {{full_name}}-style placeholders —
 * the point is a non-technical user never has to know that syntax exists)
 * into editable Subject/Message fields; leaving it on "Write your own" is a
 * fully custom one-off email. Either way this actually sends, via the same
 * Brevo pipeline the rest of the app uses.
 */
export function SendEmailDialog({
  name,
  email,
  templates,
  signatures,
  resolveTemplate,
  sendAction,
}: {
  name: string;
  email: string | null;
  templates: Template[];
  signatures: Signature[];
  resolveTemplate: (templateKey: string) => Promise<TemplateResult>;
  sendAction: (payload: {
    to: string;
    subject: string;
    body: string;
    templateKey: string | null;
    signatureId: string | null;
  }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(email ?? '');
  const [templateKey, setTemplateKey] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signatureId, setSignatureId] = useState(() => defaultSignatureId(signatures));
  const [resolving, startResolve] = useTransition();
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const personalSignatures = signatures.filter((s) => s.profile_id !== null);
  const sharedSignatures = signatures.filter((s) => s.profile_id === null);

  function reset() {
    setTo(email ?? '');
    setTemplateKey('');
    setSubject('');
    setBody('');
    setSignatureId(defaultSignatureId(signatures));
    setError(null);
    setSent(false);
  }

  function handleTemplateChange(key: string) {
    setTemplateKey(key);
    setError(null);
    setSent(false);
    if (!key) return;
    startResolve(async () => {
      const res = await resolveTemplate(key);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubject(res.subject);
      // The template's body is plain text; the compose box is rich text —
      // give it an HTML starting point instead of one unformatted line.
      setBody(plainTextToHtml(res.body));
    });
  }

  function handleSend() {
    setError(null);
    startSend(async () => {
      const res = await sendAction({
        to: to.trim(),
        subject: subject.trim(),
        body,
        templateKey: templateKey || null,
        signatureId: signatureId || null,
      });
      if (!res.ok) setError(res.error ?? 'Could not send email.');
      else setSent(true);
    });
  }

  const busy = resolving || sending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          title="Email"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-tenant-accent2/20 bg-tenant-accent2/10 text-tenant-accent2 transition-colors hover:bg-tenant-accent2/20"
        >
          <Mail className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Email {name}</DialogTitle>
          <DialogDescription>
            Pick a template to start from, or write your own — everything&rsquo;s editable before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="send-email-to">Email address</Label>
            <Input
              id="send-email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={busy}
              className="mt-1.5"
            />
          </div>

          {templates.length > 0 && (
            <div>
              <Label htmlFor="send-email-template">Template</Label>
              <Select
                id="send-email-template"
                value={templateKey}
                disabled={busy}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Write your own</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="send-email-subject">Subject</Label>
            <Input
              id="send-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="send-email-body">Message</Label>
            <div className="mt-1.5">
              <RichTextEditor value={body} onChange={setBody} disabled={busy} />
            </div>
          </div>

          {signatures.length > 0 && (
            <div>
              <Label htmlFor="send-email-signature">Signature</Label>
              <Select
                id="send-email-signature"
                value={signatureId}
                disabled={busy}
                onChange={(e) => setSignatureId(e.target.value)}
                className="mt-1.5"
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
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {sent && !error && <p className="text-sm text-emerald-700">Email sent.</p>}

          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
              disabled={busy || !to.trim() || !subject.trim() || isBlankHtml(body)}
              onClick={handleSend}
            >
              {sending ? 'Sending…' : 'Send email'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
