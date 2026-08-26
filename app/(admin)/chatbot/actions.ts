'use server';

import { revalidatePath } from 'next/cache';
import { requireChatbotAccess } from '@/lib/chatbot/guard';
import { createClient } from '@/lib/supabase/server';
import { sendCustomLeadEmail } from '@/app/(admin)/leads/actions';

export interface ChatbotConfirmResult {
  ok: boolean;
  error?: string;
}

interface EmailDraft {
  leadId: string;
  to: string;
  subject?: string;
  body: string;
}
interface WhatsAppDraft {
  leadId: string;
  to: string;
  body: string;
}

/**
 * Turns a pending draft (from draft_and_send_email / draft_and_send_whatsapp)
 * into an actual send. Re-reads the row via the session client, so RLS
 * (owner-only on chatbot_messages, via its parent conversation) already
 * rejects anything that isn't this staff member's own — no separate
 * ownership check needed. The model itself has no path to call this; it's
 * only reachable from a real button click in confirm-card.tsx.
 */
export async function confirmChatbotAction(
  messageId: string,
  edited: { to: string; subject?: string; body: string },
): Promise<ChatbotConfirmResult> {
  await requireChatbotAccess();
  const supabase = await createClient();

  const { data: message } = await supabase
    .from('chatbot_messages')
    .select('id, tool_name, status, tool_result')
    .eq('id', messageId)
    .maybeSingle();
  if (!message) return { ok: false, error: 'Not found.' };
  if (message.status !== 'pending_confirmation') {
    return { ok: false, error: 'This has already been actioned.' };
  }

  if (message.tool_name === 'draft_and_send_email') {
    const draft = message.tool_result as EmailDraft | null;
    if (!draft?.leadId) return { ok: false, error: 'Missing draft data.' };

    const to = edited.to.trim() || draft.to;
    const subject = (edited.subject ?? draft.subject ?? '').trim();
    const emailBody = edited.body.trim();
    if (!subject) return { ok: false, error: 'Subject is required.' };
    if (!emailBody) return { ok: false, error: 'Message is required.' };

    const res = await sendCustomLeadEmail(draft.leadId, { to, subject, body: emailBody, templateKey: null });
    if (!res.ok) return { ok: false, error: res.error ?? 'Could not send.' };

    await supabase
      .from('chatbot_messages')
      .update({ status: 'complete', content: `Sent to ${to}.`, tool_result: { ...draft, to, subject, body: emailBody, sent: true } })
      .eq('id', messageId);
    revalidatePath('/leads');
    return { ok: true };
  }

  if (message.tool_name === 'draft_and_send_whatsapp') {
    const draft = message.tool_result as WhatsAppDraft | null;
    if (!draft?.leadId) return { ok: false, error: 'Missing draft data.' };
    // No server-side WhatsApp send capability exists in this codebase — the
    // client opens wa.me itself (see confirm-card.tsx), same as the manual
    // SendWhatsAppDialog. This just records that the draft was actioned.
    await supabase
      .from('chatbot_messages')
      .update({ status: 'complete', content: 'Opened in WhatsApp.', tool_result: { ...draft, ...edited, actioned: true } })
      .eq('id', messageId);
    return { ok: true };
  }

  return { ok: false, error: 'Unknown draft type.' };
}

/** Discards a pending draft without sending anything. */
export async function cancelChatbotAction(messageId: string): Promise<ChatbotConfirmResult> {
  await requireChatbotAccess();
  const supabase = await createClient();

  const { data: message } = await supabase
    .from('chatbot_messages')
    .select('id, status')
    .eq('id', messageId)
    .maybeSingle();
  if (!message) return { ok: false, error: 'Not found.' };
  if (message.status !== 'pending_confirmation') return { ok: true };

  await supabase.from('chatbot_messages').update({ status: 'cancelled' }).eq('id', messageId);
  return { ok: true };
}
