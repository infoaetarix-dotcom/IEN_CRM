'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/** Simplified WhatsApp glyph — lucide-react ships no brand icons. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Z" />
      <path d="M12.002 2C6.478 2 2 6.477 2 12c0 1.876.52 3.632 1.42 5.132L2 22l4.98-1.394A9.95 9.95 0 0 0 12.002 22C17.526 22 22 17.523 22 12S17.526 2 12.002 2Zm0 18.2a8.18 8.18 0 0 1-4.353-1.257l-.312-.185-3.038.85.834-2.962-.203-.32A8.17 8.17 0 0 1 3.8 12c0-4.522 3.68-8.2 8.202-8.2 4.521 0 8.2 3.678 8.2 8.2 0 4.522-3.679 8.2-8.2 8.2Z" />
    </svg>
  );
}

function toWaDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * "WhatsApp" trigger + popup — no paid API involved. Opens a wa.me link with
 * the number and message pre-filled; the staff member still presses Send
 * inside WhatsApp itself. Purely client-side, nothing is logged server-side
 * since we can never confirm the message actually went out.
 */
export function SendWhatsAppDialog({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(phone ?? '');
  const [message, setMessage] = useState(`Hi ${name}, `);

  const digits = toWaDigits(number);
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="WhatsApp"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
        >
          <WhatsAppIcon className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">WhatsApp {name}</DialogTitle>
          <DialogDescription>
            Opens WhatsApp with this number and message ready — you send it from there.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="wa-number">Phone number</Label>
            <Input
              id="wa-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+92 300 1234567"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="wa-message">Message</Label>
            <Textarea
              id="wa-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-600/90"
              disabled={!waHref}
              onClick={() => {
                if (!waHref) return;
                window.open(waHref, '_blank', 'noopener,noreferrer');
                setOpen(false);
              }}
            >
              <WhatsAppIcon className="h-4 w-4" /> Open WhatsApp
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
