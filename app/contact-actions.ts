'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { rateLimit } from '@/lib/security/rate-limit';
import { sendTransactionalEmail } from '@/lib/email/brevo';

export interface ContactState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  consultancy: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Tell us a little about what you need').max(2000),
  // Honeypot — a field named to look plausible to bots, hidden from real users
  // via CSS. Must stay empty.
  website: z.string().max(0).optional(),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

function fieldErrorsFrom(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = i.message;
  }
  return out;
}

const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || 'info.aetarix@gmail.com';

/**
 * Platform contact form (not a lead — no organization_id, nothing tenant-
 * scoped). Hardened like any public write: rate limit + Turnstile + honeypot
 * + Zod, same pattern as the apply wizard's startLead.
 */
export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const ip = await clientIp();
  const limited = await rateLimit(`contact:${ip}`, 5, 10 * 60 * 1000);
  if (!limited.success) {
    return { ok: false, error: 'Too many submissions. Please try again shortly.' };
  }

  const token = formData.get('cf-turnstile-response');
  const verified = await verifyTurnstile(
    typeof token === 'string' ? token : null,
    ip === 'unknown' ? undefined : ip,
  );
  if (!verified) {
    return { ok: false, error: 'Bot verification failed. Please refresh and try again.' };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    consultancy: formData.get('consultancy'),
    message: formData.get('message'),
    website: formData.get('website'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const d = parsed.data;
  const res = await sendTransactionalEmail({
    to: CONTACT_INBOX,
    toName: 'Aetarix',
    subject: `New inquiry from ${d.name}${d.consultancy ? ` (${d.consultancy})` : ''}`,
    body: [
      `Name: ${d.name}`,
      `Email: ${d.email}`,
      `Consultancy: ${d.consultancy || '—'}`,
      '',
      'Message:',
      d.message,
    ].join('\n'),
  });
  if (!res.ok) {
    return {
      ok: false,
      error: 'Could not send your message. Please try again or email us directly.',
    };
  }

  return { ok: true };
}
