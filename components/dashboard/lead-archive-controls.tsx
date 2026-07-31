'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import {
  archiveLead,
  unarchiveLead,
  deleteLead,
} from '@/app/(admin)/leads/actions';
import { Button } from '@/components/ui/button';

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onOk?: () => void,
  ) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
      else if (onOk) onOk();
      else router.refresh();
    });
  };
  return { pending, error, run, router };
}

/** Archive/Restore + (admin) permanent-delete controls for the lead detail page. */
export function LeadActions({
  leadId,
  isArchived,
  canArchive,
  canDelete,
}: {
  leadId: string;
  isArchived: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const { pending, error, run, router } = useRun();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      {canArchive &&
        (isArchived ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => unarchiveLead(leadId))}
          >
            <ArchiveRestore className="mr-2 h-4 w-4" /> Restore lead
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => archiveLead(leadId))}
          >
            <Archive className="mr-2 h-4 w-4" /> Archive lead
          </Button>
        ))}

      {canDelete && (
        <div className="border-t border-line pt-3">
          {!confirming ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete permanently
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                This permanently deletes the lead and all its notes, history, and
                messages. It cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(() => deleteLead(leadId), () => router.push('/leads'))
                  }
                >
                  {pending ? 'Deleting…' : 'Yes, delete'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Inline Restore button for rows in the archived-leads list. */
export function RestoreLeadButton({ leadId }: { leadId: string }) {
  const { pending, error, run } = useRun();
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => unarchiveLead(leadId))}
      >
        {pending ? 'Restoring…' : 'Restore'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
