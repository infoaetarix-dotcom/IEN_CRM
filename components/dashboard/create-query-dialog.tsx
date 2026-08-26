'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { QuickQueryForm } from '@/components/dashboard/quick-query-form';
import { PasteLeadEntry } from '@/components/dashboard/chatbot/paste-lead-entry';
import type { ExtractedLead } from '@/lib/validation/chatbot';

/** "Create query" trigger + popup on /leads — a query taken over the phone or in person. */
export function CreateQueryDialog({
  consentName,
  aiEnabled = false,
}: {
  consentName: string;
  /** Org has the AI Assistant module on — shows the "paste raw text" shortcut. */
  aiEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<ExtractedLead | undefined>(undefined);
  // Bumped on every successful extraction to force QuickQueryForm to remount
  // — its fields read `initial` only as a React defaultValue (uncontrolled),
  // so a fresh key is what actually applies newly parsed data.
  const [formKey, setFormKey] = useState(0);

  function handleClose() {
    setOpen(false);
    setInitial(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90">
          <Plus className="h-4 w-4" /> Create query
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Create query</DialogTitle>
          <DialogDescription>
            For a query taken over the phone or in person — nothing is required, save whatever you have.
          </DialogDescription>
        </DialogHeader>
        {aiEnabled && (
          <PasteLeadEntry
            onExtracted={(data) => {
              setInitial(data);
              setFormKey((k) => k + 1);
            }}
          />
        )}
        <QuickQueryForm key={formKey} consentName={consentName} onClose={handleClose} initial={initial} />
      </DialogContent>
    </Dialog>
  );
}
