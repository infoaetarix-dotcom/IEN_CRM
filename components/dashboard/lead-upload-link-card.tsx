'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, RotateCw } from 'lucide-react';
import { regenerateLeadUploadLink } from '@/app/(admin)/leads/actions';
import { Button } from '@/components/ui/button';

function expiryLabel(expiresAt: string): { text: string; expired: boolean } {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffMs < 0) return { text: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`, expired: true };
  if (diffDays === 0) return { text: 'Expires today', expired: false };
  return { text: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`, expired: false };
}

/** Mirrors UploadLinkCard (components/dashboard/applications/upload-link-card.tsx) — copy + regenerate for a lead's own document-upload link. */
export function LeadUploadLinkCard({
  leadId,
  url,
  expiresAt,
}: {
  leadId: string;
  url: string;
  expiresAt: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { text, expired } = expiryLabel(expiresAt);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    if (!confirm('Regenerate this link? The current link will stop working immediately.')) return;
    setError(null);
    start(async () => {
      const res = await regenerateLeadUploadLink(leadId);
      if (!res.ok) setError(res.error ?? 'Could not regenerate the link.');
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <code className="block truncate rounded-md border border-tenant-ink/10 bg-tenant-gray px-3 py-2 text-xs text-tenant-ink">
        {url}
      </code>
      <p className={`text-xs ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>{text}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={handleRegenerate}>
          <RotateCw className="mr-1.5 h-3.5 w-3.5" /> {pending ? 'Regenerating…' : 'Regenerate'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
