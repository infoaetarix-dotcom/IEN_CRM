'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ExtractedLead } from '@/lib/validation/chatbot';

/**
 * "Paste raw lead text" entry point above the Create Query form — a WhatsApp
 * message, an email, phone notes, any format. Calls the tool-less
 * extract-lead endpoint and hands the parsed (but unsaved) fields up to the
 * dialog, which remounts the form with them as defaults. Nothing is ever
 * saved from here — the form save button is still a separate, deliberate step.
 */
export function PasteLeadEntry({ onExtracted }: { onExtracted: (data: ExtractedLead) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chatbot/extract-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Could not read that.');
      onExtracted(body.data as ExtractedLead);
      setOpen(false);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-tenant-accent hover:underline"
      >
        <Sparkles className="h-3.5 w-3.5" /> Paste raw lead text and fill automatically
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-tenant-ink/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
        Paste raw lead text
      </p>
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a WhatsApp message, email, or notes — any format."
        disabled={loading}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={extract} disabled={loading || !text.trim()} className="bg-tenant-accent text-white hover:bg-tenant-accent/90">
          {loading ? 'Reading…' : 'Fill form'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
