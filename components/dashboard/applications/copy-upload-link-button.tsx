'use client';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Copies the student document-upload link to the clipboard — icon-only,
 * matches the other row-action buttons. Shared by both the applications and
 * leads tables; `entity` only changes the tooltip wording.
 */
export function CopyUploadLinkButton({
  url,
  expired,
  entity = 'application',
}: {
  url: string;
  expired: boolean;
  entity?: 'application' | 'lead';
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className={
        expired
          ? 'h-8 w-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-600'
          : 'h-8 w-8 rounded-lg border border-tenant-accent2/20 bg-tenant-accent2/10 text-tenant-accent2 hover:bg-tenant-accent2/20 hover:text-tenant-accent2'
      }
      title={
        expired
          ? `Upload link expired — copies the old link; open the ${entity} to regenerate`
          : 'Copy student upload link'
      }
      onClick={handleCopy}
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
    </Button>
  );
}
