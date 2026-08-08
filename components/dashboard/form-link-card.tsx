'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

/** Shows the org's public application URL with a one-click copy button. */
export function FormLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-tenant-ink/10 bg-white p-6">
      <p className="label-eyebrow">Your public application form</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="flex-1 truncate rounded-md border border-tenant-ink/10 bg-tenant-gray px-3 py-2 text-sm text-tenant-ink">
          {url}
        </code>
        <div className="flex flex-none gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-tenant-ink/10 px-3 text-sm text-tenant-ink hover:bg-tenant-gray"
          >
            <ExternalLink className="h-4 w-4" /> Open
          </a>
        </div>
      </div>
      <p className="mt-4 text-sm text-tenant-ink/60">
        Share this link with prospective students, or add it to your website,
        ads, and social bios. Every submission comes straight into your Leads
        pipeline.
      </p>
    </div>
  );
}
