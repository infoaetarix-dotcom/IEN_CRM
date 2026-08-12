'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'youtube', label: 'YouTube' },
] as const;

function CopyRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-tenant-ink/10 py-2.5 last:border-b-0">
      <span className="w-20 flex-none text-sm font-medium text-tenant-ink">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs text-tenant-ink/60">{url}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-tenant-ink/10 px-2.5 text-xs text-tenant-ink hover:bg-tenant-gray"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * One tracked link per platform (?utm_source=<platform>) built off a given
 * base form URL — the default link and, if set, the custom form domain each
 * get their own instance so both stay taggable the same way.
 */
export function SocialSourceLinks({ baseUrl, label }: { baseUrl: string; label: string }) {
  return (
    <div className="rounded-lg border border-tenant-ink/10 bg-white p-6">
      <p className="label-eyebrow">{label}</p>
      <p className="mt-1 text-sm text-tenant-ink/60">
        Send the matching link to each platform — submissions through it are tagged
        with that source, so Leads → filter by Source shows exactly where each
        applicant came from.
      </p>
      <div className="mt-4">
        {PLATFORMS.map((p) => (
          <CopyRow key={p.key} label={p.label} url={`${baseUrl}?utm_source=${p.key}`} />
        ))}
      </div>
    </div>
  );
}
