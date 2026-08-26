'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

/**
 * Manual "refresh this page's data" control. The AI assistant runs through
 * /api/chatbot (a Route Handler), not a Server Action, so when it creates or
 * changes something in the background the currently-open page has no signal
 * to re-fetch — router.refresh() re-runs this route's Server Components
 * against fresh data without a full page reload.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="Refresh"
      title="Refresh"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-tenant-offwhite transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
    </button>
  );
}
