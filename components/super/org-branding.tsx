'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { uploadOrgLogo, updateOrgLegalName } from '@/app/super/actions';
import { Brandmark } from '@/components/branding/brandmark';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { OrgBrand } from '@/lib/branding';

/**
 * Branding controls for one consultancy: the logo their staff and applicants
 * see, and the full name used in consent text and emails.
 */
export function OrgBranding({
  orgId,
  brand,
}: {
  orgId: string;
  brand: OrgBrand;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [legalName, setLegalName] = useState(brand.legalName);

  function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setSaved(null);
    start(async () => {
      const res = await uploadOrgLogo(orgId, form);
      if (!res.ok) setError(res.error ?? 'Upload failed.');
      else {
        setSaved('Logo updated.');
        router.refresh();
      }
    });
  }

  function saveName() {
    setError(null);
    setSaved(null);
    start(async () => {
      const res = await updateOrgLegalName(orgId, legalName);
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else {
        setSaved('Name updated.');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Preview on both surfaces the logo actually appears on */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 items-center rounded-md bg-marketing-navy px-4">
          <Brandmark brand={brand} size="h-8" />
        </div>
        <div className="flex h-16 items-center rounded-md border border-marketing-ink/10 bg-white px-4">
          <Brandmark brand={brand} size="h-8" />
        </div>
        <p className="text-xs text-muted-foreground">
          {brand.logoUrl
            ? 'Shown on dark and light surfaces.'
            : 'No logo yet — initials are shown until one is uploaded.'}
        </p>
      </div>

      <form onSubmit={upload} className="space-y-2">
        <Label htmlFor="logo">Logo</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            required
            disabled={pending}
            className="max-w-xs"
          />
          <Button
            type="submit"
            size="sm"
            className="bg-marketing-blue text-white hover:bg-marketing-blue/90"
            disabled={pending}
          >
            {pending ? 'Uploading…' : 'Upload logo'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WEBP or SVG, under 1 MB. A transparent background works on
          both dark and light surfaces.
        </p>
      </form>

      <div className="space-y-2">
        <Label htmlFor="legal_name">Full name</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="legal_name"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            disabled={pending}
            className="max-w-xs"
            placeholder="International Education Network"
          />
          <Button size="sm" variant="outline" onClick={saveName} disabled={pending}>
            Save name
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Used where the consultancy must be named in full — the application
          form&rsquo;s consent line and outgoing emails.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-700">{saved}</p>}
    </div>
  );
}
