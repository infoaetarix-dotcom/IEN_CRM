'use server';

import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireTeamChat } from '@/lib/chat/guard';
import { notifyChatRecipients } from '@/lib/chat/notify';

/**
 * Team chat actions (0051_team_chat.sql). Each starts with the module
 * guard; the database re-checks membership, org, module and (for groups)
 * admin role on every call, so these are thin.
 */

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const uuid = z.string().uuid();

/** Turn a database exception from a chat function into a message for the UI. */
function dbError(err: { message?: string } | null, fallback: string): string {
  const msg = err?.message ?? '';
  return /not available|choose|only admins|enter a group name|not found/i.test(msg) ? msg : fallback;
}

export async function sendChatMessage(conversationId: string, text: string): Promise<Result<{ message: ChatMessage }>> {
  const profile = await requireTeamChat();
  const body = text.trim();
  if (!uuid.safeParse(conversationId).success) return { ok: false, error: 'Conversation not found.' };
  if (!body) return { ok: false, error: 'Type a message first.' };
  if (body.length > 4000) return { ok: false, error: 'Keep messages under 4,000 characters.' };

  const supabase = await createClient();
  // RLS checks the sender is a member and the module is on.
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({ organization_id: profile.organization_id, conversation_id: conversationId, sender_id: profile.id, body })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();
  if (error || !message) return { ok: false, error: 'Could not send the message.' };

  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('kind, name')
    .eq('id', conversationId)
    .single();

  // Bell + email for the others, after the reply so sending feels instant.
  after(() =>
    notifyChatRecipients({
      organizationId: profile.organization_id!,
      conversationId,
      senderId: profile.id,
      senderName: profile.full_name || 'A colleague',
      groupName: conv?.kind === 'group' ? conv.name : null,
    }),
  );

  return { ok: true, message };
}

export async function openDirectChat(otherProfileId: string): Promise<Result<{ conversationId: string }>> {
  await requireTeamChat();
  if (!uuid.safeParse(otherProfileId).success) return { ok: false, error: 'Choose a colleague to message.' };
  const { data, error } = await (await createClient()).rpc('chat_open_direct', { other: otherProfileId });
  if (error || !data) return { ok: false, error: dbError(error, 'Could not open the chat.') };
  return { ok: true, conversationId: data as string };
}

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Enter a group name').max(80, 'Keep the name under 80 characters'),
  memberIds: z.array(uuid).max(200),
});

/** Admins only — enforced here and again in chat_create_group. */
export async function createGroupChat(name: string, memberIds: string[]): Promise<Result<{ conversationId: string }>> {
  const profile = await requireTeamChat();
  if (profile.role !== 'admin') return { ok: false, error: 'Only admins can create group chats.' };
  const parsed = groupSchema.safeParse({ name, memberIds });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  if (!parsed.data.memberIds.length) return { ok: false, error: 'Add at least one member.' };

  const { data, error } = await (await createClient()).rpc('chat_create_group', {
    group_name: parsed.data.name,
    member_ids: parsed.data.memberIds,
  });
  if (error || !data) return { ok: false, error: dbError(error, 'Could not create the group.') };
  return { ok: true, conversationId: data as string };
}

/** Admins only — rename a group and set its members. */
export async function updateGroupChat(conversationId: string, name: string, memberIds: string[]): Promise<Result> {
  const profile = await requireTeamChat();
  if (profile.role !== 'admin') return { ok: false, error: 'Only admins can manage group chats.' };
  const parsed = groupSchema.safeParse({ name, memberIds });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  if (!uuid.safeParse(conversationId).success) return { ok: false, error: 'Group not found.' };

  const { error } = await (await createClient()).rpc('chat_update_group', {
    conv: conversationId,
    group_name: parsed.data.name,
    member_ids: parsed.data.memberIds,
  });
  if (error) return { ok: false, error: dbError(error, 'Could not update the group.') };
  return { ok: true };
}
