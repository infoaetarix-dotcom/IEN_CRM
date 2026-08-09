'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { setOrgDomains } from '@/app/super/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-marketing-ink/10 bg-marketing-gray px-3 py-2 text-xs text-marketing-ink">
        {url}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        title="Copy"
        className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md border border-marketing-ink/10 text-marketing-ink hover:bg-marketing-gray"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        title="Open"
        className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md border border-marketing-ink/10 text-marketing-ink hover:bg-marketing-gray"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

/**
 * Custom domain controls for one consultancy: their own form_domain and
 * portal_domain (Phase 2). Only takes effect once the domain is also added
 * to the Vercel project with its DNS CNAME pointed at Vercel — this just
 * tells the app which org owns it once traffic arrives.
 */
export function OrgDomains({
  orgId,
  slug,
  formDomain,
  portalDomain,
}: {
  orgId: string;
  slug: string;
  formDomain: string | null;
  portalDomain: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(formDomain ?? '');
  const [portal, setPortal] = useState(portalDomain ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await setOrgDomains(orgId, form, portal);
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
          Default form link
        </p>
        <CopyableLink url={`${APP_URL}/${slug}/apply`} />
        <p className="text-xs text-muted-foreground">
          Always works, no setup required — use this until (or alongside) a
          custom domain below.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="form_domain">Custom form domain</Label>
        <Input
          id="form_domain"
          value={form}
          onChange={(e) => setForm(e.target.value)}
          disabled={pending}
          placeholder="form.theirdomain.com"
        />
        {formDomain && <CopyableLink url={`https://${formDomain}`} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="portal_domain">Custom portal domain</Label>
        <Input
          id="portal_domain"
          value={portal}
          onChange={(e) => setPortal(e.target.value)}
          disabled={pending}
          placeholder="portal.theirdomain.com"
        />
        {portalDomain && <CopyableLink url={`https://${portalDomain}`} />}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          className="bg-marketing-blue text-white hover:bg-marketing-blue/90"
          onClick={save}
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Save domains'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && <p className="text-sm text-emerald-700">Saved.</p>}
      </div>

      <p className="text-xs text-muted-foreground">
        After saving, add the domain to the Vercel project (Settings →
        Domains) and point its DNS CNAME at Vercel — see
        docs/FORM_SUBDOMAIN.md. Until that&rsquo;s done, the domain won&rsquo;t
        route here even though it&rsquo;s saved.
      </p>
    </div>
  );
}
