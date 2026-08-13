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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type Template = { key: string; name: string; subject: string; body: string };
type ActionResult = { ok: boolean; error?: string };
type TemplateResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; error: string };

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
  resolveTemplate,
  sendAction,
}: {
  name: string;
  email: string | null;
  templates: Template[];
  resolveTemplate: (templateKey: string) => Promise<TemplateResult>;
  sendAction: (payload: {
    to: string;
    subject: string;
    body: string;
    templateKey: string | null;
  }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(email ?? '');
  const [templateKey, setTemplateKey] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [resolving, startResolve] = useTransition();
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function reset() {
    setTo(email ?? '');
    setTemplateKey('');
    setSubject('');
    setBody('');
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
      setBody(res.body);
    });
  }

  function handleSend() {
    setError(null);
    startSend(async () => {
      const res = await sendAction({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        templateKey: templateKey || null,
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
            <Textarea
              id="send-email-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
              className="mt-1.5"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {sent && !error && <p className="text-sm text-emerald-700">Email sent.</p>}

          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
              disabled={busy || !to.trim() || !subject.trim() || !body.trim()}
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
