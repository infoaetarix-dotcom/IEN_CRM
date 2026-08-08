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

/** "Create query" trigger + popup on /leads — a query taken over the phone or in person. */
export function CreateQueryDialog({ consentName }: { consentName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <QuickQueryForm consentName={consentName} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
