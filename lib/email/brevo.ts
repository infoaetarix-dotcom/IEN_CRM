import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { brandFromOrg } from '@/lib/branding';

/**
 * Brevo transactional email + message logging.
 *
 * Template variables are interpolated server-side from a FIXED allow-list only
 * (README §8.5) — never arbitrary keys, so a template cannot exfiltrate data.
 */

const ALLOWED_VARS = [
  'full_name',
  'program',
  'target_country',
  'institution',
] as const;

type AllowedVar = (typeof ALLOWED_VARS)[number];

export function renderTemplate(
  text: string,
  vars: Partial<Record<AllowedVar, string | null | undefined>>,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if ((ALLOWED_VARS as readonly string[]).includes(key)) {
      return (vars[key as AllowedVar] ?? '').toString();
    }
    return match; // leave unknown placeholders untouched
  });
}

export interface TransactionalEmail {
  to: string;
  toName?: string | null;
  subject: string;
  /** Plain text; newlines become <br/> and the content is HTML-escaped. */
  body: string;
  /**
   * Set when `body` is already HTML (the rich text compose box) rather than
   * plain text — skips escaping so the markup renders instead of showing as
   * literal tags. Never set this for text sourced from a saved template or
   * any other unescaped input; only the compose box's own controlled output.
   */
  bodyIsHtml?: boolean;
  /**
   * Display name recipients see as the sender — should be the consultancy's
   * own name for anything tied to a tenant, never a fixed platform default.
   * Falls back to BREVO_SENDER_NAME (then a hardcoded default) only when the
   * caller has no org context to give one.
   */
  senderName?: string | null;
  /**
   * Org's own verified "From" address (organizations.sender_email) — takes
   * priority over BREVO_SENDER_EMAIL when present. Falls back to the shared
   * platform default when null/undefined/'', exactly like senderName falls
   * back to BREVO_SENDER_NAME. Must be Brevo-domain-verified (SPF/DKIM) or
   * Brevo rejects the send; that verification is a human/Brevo-dashboard
   * task done outside this app (Super Admin → org → Email sets the value).
   */
  senderEmail?: string | null;
  /**
   * Trusted, already-vetted signature HTML (see lib/email/signatures.ts) —
   * appended UNESCAPED after the escaped body. Never populate this from raw
   * client input: `body` is always plain text and safe to escape wholesale,
   * but signatureHtml is rich markup that would be mangled (`<b>` rendered
   * as literal text) by the same escaping.
   */
  signatureHtml?: string | null;
}

/**
 * Raw Brevo transport — no lead, no message log. Used for emails that aren't
 * tied to a lead (staff password resets and other account mail). Lead-facing
 * mail should use `sendEmail`, which logs every attempt to `messages`.
 *
 * Each tenant can set its own verified sender *address* in Super Admin
 * (organizations.sender_email) — falls back to the shared platform default
 * (BREVO_SENDER_EMAIL) for any org that hasn't configured one. Every tenant
 * also gets its own sender *name* regardless, so recipients see the
 * consultancy that actually contacted them even before they've set up their
 * own domain.
 */
export async function sendTransactionalEmail(
  params: TransactionalEmail,
): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = params.senderEmail || process.env.BREVO_SENDER_EMAIL;
  const senderName = params.senderName || process.env.BREVO_SENDER_NAME || 'Aetarix CRM';

  if (!apiKey || !senderEmail) {
    return { ok: false, error: 'Brevo not configured' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: params.to, name: params.toName ?? undefined }],
        subject: params.subject,
        htmlContent: `<div style="font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0B1F33">${
          params.bodyIsHtml ? params.body : escapeHtml(params.body).replace(/\n/g, '<br/>')
        }${
          params.signatureHtml ? `<div style="margin-top:20px">${params.signatureHtml}</div>` : ''
        }</div>`,
      }),
    });

    if (!res.ok) {
      return { ok: false, error: (await res.text()).slice(0, 500) };
    }

    const data = (await res.json()) as { messageId?: string };
    return { ok: true, providerMessageId: data.messageId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'send failed',
    };
  }
}

interface SendParams {
  leadId: string;
  organizationId: string;
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  /** See TransactionalEmail.bodyIsHtml — threaded through and also recorded on the messages row. */
  bodyIsHtml?: boolean;
  templateKey?: string | null;
  /** acting staff user id; null = system (auto confirmation) */
  sentBy: string | null;
  /** The signature row this send used, if any — for the messages audit trail. */
  signatureId?: string | null;
  signatureHtml?: string | null;
}

interface SendResult {
  ok: boolean;
  messageId: string;
  providerMessageId?: string;
  error?: string;
}

/**
 * Send via Brevo and log every attempt to `messages`:
 * queued → sent (with provider id) or failed (with error_detail).
 */
export async function sendEmail(params: SendParams): Promise<SendResult> {
  const supabase = createServiceClient();

  // The sending org's own name and sender address — never a different (or default) tenant's.
  const { data: org } = await supabase
    .from('organizations')
    .select('name, legal_name, sender_email')
    .eq('id', params.organizationId)
    .single();
  const senderName = org ? brandFromOrg(org).legalName : undefined;

  // 1. Log as queued first so nothing is ever sent without a record.
  const { data: msg, error: logErr } = await supabase
    .from('messages')
    .insert({
      lead_id: params.leadId,
      organization_id: params.organizationId,
      channel: 'email',
      template_key: params.templateKey ?? null,
      subject: params.subject,
      body: params.body,
      body_is_html: params.bodyIsHtml ?? false,
      status: 'queued',
      sent_by: params.sentBy,
      signature_id: params.signatureId ?? null,
    })
    .select('id')
    .single();

  if (logErr || !msg) {
    return { ok: false, messageId: '', error: logErr?.message ?? 'log failed' };
  }

  // 2. Send via the shared Brevo transport, then record the outcome.
  const res = await sendTransactionalEmail({
    to: params.to,
    toName: params.toName,
    subject: params.subject,
    body: params.body,
    bodyIsHtml: params.bodyIsHtml,
    senderName,
    senderEmail: org?.sender_email,
    signatureHtml: params.signatureHtml,
  });

  if (!res.ok) {
    await supabase
      .from('messages')
      .update({
        status: 'failed',
        error_detail: (res.error ?? 'send failed').slice(0, 500),
      })
      .eq('id', msg.id);
    return { ok: false, messageId: msg.id, error: res.error };
  }

  await supabase
    .from('messages')
    .update({
      status: 'sent',
      provider_message_id: res.providerMessageId ?? null,
    })
    .eq('id', msg.id);

  return {
    ok: true,
    messageId: msg.id,
    providerMessageId: res.providerMessageId,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
