'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrgSenderEmail } from '@/app/super/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Per-consultancy outbound sender address. Overrides the shared
 * BREVO_SENDER_EMAIL fallback for every email this org sends — lead mail,
 * staff notifications, password resets (see lib/email/brevo.ts). Only takes
 * effect once the address's domain is verified in Brevo (SPF/DKIM); until
 * then leave blank and the shared default keeps working exactly as today.
 */
export function OrgSenderEmail({
  orgId,
  senderEmail,
}: {
  orgId: string;
  senderEmail: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(senderEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await setOrgSenderEmail(orgId, email);
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="sender_email">Sender email</Label>
        <Input
          id="sender_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          placeholder="info@theirdomain.com"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          className="bg-marketing-blue text-white hover:bg-marketing-blue/90"
          onClick={save}
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Save sender email'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && <p className="text-sm text-emerald-700">Saved.</p>}
      </div>

      <p className="text-xs text-muted-foreground">
        This address must be domain-verified in Brevo (SPF/DKIM) before mail
        actually sends from it — Brevo will reject the send otherwise. Leave
        blank to keep using the shared default sender.
      </p>
    </div>
  );
}
