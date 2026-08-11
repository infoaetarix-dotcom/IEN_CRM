'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateApplicationStatus, deleteApplication } from '@/app/(admin)/applications/actions';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LEAD_STATUSES, STATUS_LABELS } from '@/lib/leads/display';

export function ApplicationStatusChanger({
  applicationId,
  current,
}: {
  applicationId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Select
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          start(async () => {
            const res = await updateApplicationStatus(applicationId, e.target.value);
            if (!res.ok) setError(res.error ?? 'Something went wrong.');
            else router.refresh();
          });
        }}
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

export function DeleteApplicationButton({
  applicationId,
  leadId,
}: {
  applicationId: string;
  leadId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/5"
        disabled={pending}
        onClick={() => {
          if (!confirm('Delete this application? This cannot be undone.')) return;
          setError(null);
          start(async () => {
            const res = await deleteApplication(applicationId);
            if (!res.ok) setError(res.error ?? 'Could not delete this application.');
            else router.push(`/leads/${leadId}`);
          });
        }}
      >
        {pending ? 'Deleting…' : 'Delete application'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
