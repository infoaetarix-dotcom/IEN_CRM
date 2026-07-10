import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

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

interface SendParams {
  leadId: string;
  organizationId: string;
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  templateKey?: string | null;
  /** acting staff user id; null = system (auto confirmation) */
  sentBy: string | null;
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
      status: 'queued',
      sent_by: params.sentBy,
    })
    .select('id')
    .single();

  if (logErr || !msg) {
    return { ok: false, messageId: '', error: logErr?.message ?? 'log failed' };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? 'Visa Consultancy';

  // No API key locally → mark failed but don't throw, so the flow is testable.
  if (!apiKey || !senderEmail) {
    await supabase
      .from('messages')
      .update({ status: 'failed', error_detail: 'Brevo not configured' })
      .eq('id', msg.id);
    return { ok: false, messageId: msg.id, error: 'Brevo not configured' };
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
        htmlContent: `<div style="font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0B1F33">${escapeHtml(
          params.body,
        ).replace(/\n/g, '<br/>')}</div>`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      await supabase
        .from('messages')
        .update({ status: 'failed', error_detail: detail.slice(0, 500) })
        .eq('id', msg.id);
      return { ok: false, messageId: msg.id, error: detail };
    }

    const data = (await res.json()) as { messageId?: string };
    await supabase
      .from('messages')
      .update({
        status: 'sent',
        provider_message_id: data.messageId ?? null,
      })
      .eq('id', msg.id);

    return { ok: true, messageId: msg.id, providerMessageId: data.messageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'send failed';
    await supabase
      .from('messages')
      .update({ status: 'failed', error_detail: detail.slice(0, 500) })
      .eq('id', msg.id);
    return { ok: false, messageId: msg.id, error: detail };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
