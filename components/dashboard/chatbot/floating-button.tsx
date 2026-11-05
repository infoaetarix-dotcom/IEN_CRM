'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { ChatPanel } from '@/components/dashboard/chatbot/chat-panel';
import { cn } from '@/lib/utils';

/**
 * Mounted in app/(admin)/layout.tsx, gated on enabledModules.includes('chatbot')
 * — org-level on/off, not a route. Fixed bottom-right, matches a standard
 * chat-widget placement so it never collides with page content or the
 * mobile nav row.
 */
export function FloatingChatButton() {
  const [open, setOpen] = useState(false);
  // On Messages the bottom-right corner is the team chat's Send button —
  // sit above it instead of covering it.
  const onMessages = usePathname().startsWith('/messages');

  return (
    <div className={cn('fixed right-5 z-50 flex flex-col items-end gap-3', onMessages ? 'bottom-24' : 'bottom-5')}>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-tenant-accent text-white shadow-lg transition-transform hover:scale-105"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    </div>
  );
}
