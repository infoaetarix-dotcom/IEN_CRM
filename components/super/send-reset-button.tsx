'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Check } from 'lucide-react';
import { sendPasswordReset } from '@/app/super/actions';

/** Super-admin-only: send a staff member a password-reset email. */
export function SendResetButton({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending || sent}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await sendPasswordReset(userId, orgId);
            if (!res.ok) setError(res.error ?? 'Could not send.');
            else setSent(true);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-marketing-ink/10 px-2 py-1 text-xs font-medium text-marketing-ink hover:bg-marketing-gray disabled:opacity-50"
      >
        {sent ? (
          <>
            <Check className="h-3.5 w-3.5" /> Sent
          </>
        ) : (
          <>
            <KeyRound className="h-3.5 w-3.5" /> {pending ? 'Sending…' : 'Send reset link'}
          </>
        )}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
