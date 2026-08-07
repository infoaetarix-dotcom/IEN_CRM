'use client';

import { useActionState, useState } from 'react';
import { submitContact, type ContactState } from '@/app/contact-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Turnstile } from '@/components/form/turnstile';

const init: ContactState = { ok: false };

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, init);
  const [turnstileToken, setTurnstileToken] = useState('');
  const err = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div className="rounded-xl border border-marketing-ink/10 bg-white p-8 text-center shadow-xl shadow-black/10">
        <p className="font-display text-xl font-semibold text-marketing-ink">
          Thanks — message sent.
        </p>
        <p className="mt-2 text-sm text-marketing-ink/60">
          We&rsquo;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-marketing-ink/10 bg-white p-6 shadow-xl shadow-black/10 sm:p-8"
    >
      <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
      {/* Honeypot — must stay empty; hidden from real users. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" autoComplete="name" />
          {err.name && <p className="mt-1 text-xs text-destructive">{err.name}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" autoComplete="email" />
          {err.email && <p className="mt-1 text-xs text-destructive">{err.email}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="consultancy">Consultancy name</Label>
        <Input id="consultancy" name="consultancy" placeholder="Optional" />
      </div>
      <div>
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Tell us a bit about your consultancy and what you're looking for."
        />
        {err.message && (
          <p className="mt-1 text-xs text-destructive">{err.message}</p>
        )}
      </div>

      <Turnstile onVerify={setTurnstileToken} />

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full bg-marketing-blue text-white hover:bg-marketing-blue/90 sm:w-auto"
      >
        {pending ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}
