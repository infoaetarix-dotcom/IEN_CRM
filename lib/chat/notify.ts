import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { sendTransactionalEmail } from '@/lib/email/brevo';
import { brandFromOrg } from '@/lib/branding';
import { chatLink, chatNotificationTitle, isOnline, shouldEmail } from './status';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Tell the other members of a conversation that a message arrived — after
 * it's been saved. Never includes what the message says.
 *
 * Bell: ONE notification per conversation per recipient. If they already
 * have an unread one for this conversation it's refreshed (moves to the
 * top, newest sender) instead of adding another, so 15 messages = 1
 * notification. Reading the conversation clears it (chat_mark_read).
 *
 * Email: to the address the recipient logs in with, at most once per unread
 * streak and not while they're online (lib/chat/status.ts shouldEmail).
 *
 * Service role: notifications and other members' rows aren't writable by
 * the sender under RLS; this runs only after the sender's own insert passed
 * RLS (member of the conversation, module on).
 */
export async function notifyChatRecipients(params: {
  organizationId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  /** Group name, or null for a direct chat. */
  groupName: string | null;
}): Promise<void> {
  try {
    const svc = createServiceClient();
    const { data: members } = await svc
      .from('chat_members')
      .select('profile_id, last_read_at, last_emailed_at, profiles(full_name, email, is_active)')
      .eq('conversation_id', params.conversationId)
      .neq('profile_id', params.senderId);
    const recipients = (members ?? [])
      .map((m) => ({ ...m, profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles }))
      .filter((m) => m.profile?.is_active);
    if (!recipients.length) return;

    const { data: presence } = await svc
      .from('chat_presence')
      .select('profile_id, last_seen_at')
      .in('profile_id', recipients.map((r) => r.profile_id));
    const seenById = new Map((presence ?? []).map((p) => [p.profile_id, p.last_seen_at]));

    const title = chatNotificationTitle(params.senderName, params.groupName);
    const link = chatLink(params.conversationId);
    const now = new Date().toISOString();

    const { data: org } = await svc
      .from('organizations')
      .select('name, legal_name, sender_email, portal_domain')
      .eq('id', params.organizationId)
      .single();
    const appUrl = org?.portal_domain ? `https://${org.portal_domain}` : APP_URL;

    await Promise.all(
      recipients.map(async (r) => {
        const { data: existing } = await svc
          .from('notifications')
          .select('id')
          .eq('profile_id', r.profile_id)
          .eq('type', 'chat_message')
          .eq('link', link)
          .is('read_at', null)
          .limit(1)
          .maybeSingle();
        if (existing) {
          await svc.from('notifications').update({ title, created_at: now }).eq('id', existing.id);
        } else {
          await svc.from('notifications').insert({
            organization_id: params.organizationId,
            profile_id: r.profile_id,
            type: 'chat_message',
            title,
            body: null,
            link,
          });
        }

        if (r.profile?.email && shouldEmail(r, isOnline(seenById.get(r.profile_id)))) {
          // Claim the email first so two quick messages can't both send one.
          const { data: claimed } = await svc
            .from('chat_members')
            .update({ last_emailed_at: now })
            .eq('conversation_id', params.conversationId)
            .eq('profile_id', r.profile_id)
            .or(`last_emailed_at.is.null,last_emailed_at.lt."${r.last_read_at}"`)
            .select('profile_id');
          if (!claimed?.length) return;
          await sendTransactionalEmail({
            to: r.profile.email,
            toName: r.profile.full_name,
            subject: title,
            body: `<p style="margin:0 0 12px">${esc(title)}.</p>
<p style="margin:0 0 16px;color:#6b7a8d">Open the CRM to read and reply.</p>
<p style="margin:0"><a href="${esc(`${appUrl}${link}`)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open messages</a></p>`,
            bodyIsHtml: true,
            senderName: org ? brandFromOrg(org).legalName : undefined,
            senderEmail: org?.sender_email,
          });
        }
      }),
    );
  } catch (err) {
    console.error('[notifyChatRecipients] failed', err);
  }
}
