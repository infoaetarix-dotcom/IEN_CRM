import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { SessionProfile } from '@/lib/auth/guards';
import type { ChatMessage, ToolCall } from '@/lib/chatbot/provider';

/**
 * Reads/writes go through the session-scoped client, not the service role —
 * chatbot_conversations/messages RLS is owner-only (profile_id = auth.uid()),
 * which is exactly the access rule this needs, so there's no reason to
 * bypass it.
 */

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls: ToolCall[] | null;
  toolCallId: string | null;
  toolName: string | null;
  toolResult: unknown;
  status: 'complete' | 'pending_confirmation' | 'cancelled';
  createdAt: string;
}

/**
 * Loads the given conversation if it belongs to this profile, else the
 * profile's most recently updated conversation, else null (fresh start).
 */
export async function loadConversation(
  profile: SessionProfile,
  conversationId?: string,
): Promise<{ id: string; messages: StoredMessage[] } | null> {
  const supabase = await createClient();

  let id = conversationId;
  if (id) {
    const { data } = await supabase
      .from('chatbot_conversations')
      .select('id')
      .eq('id', id)
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (!data) id = undefined; // not theirs / doesn't exist — fall through
  }
  if (!id) {
    const { data } = await supabase
      .from('chatbot_conversations')
      .select('id')
      .eq('profile_id', profile.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    id = data?.id;
  }
  if (!id) return null;

  const { data: rows } = await supabase
    .from('chatbot_messages')
    .select('id, role, content, tool_calls, tool_call_id, tool_name, tool_result, status, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  return {
    id,
    messages: (rows ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      toolCalls: r.tool_calls,
      toolCallId: r.tool_call_id,
      toolName: r.tool_name,
      toolResult: r.tool_result,
      status: r.status,
      createdAt: r.created_at,
    })),
  };
}

export async function getOrCreateConversation(
  profile: SessionProfile,
  conversationId: string | undefined,
  firstMessage: string,
): Promise<string> {
  const supabase = await createClient();

  if (conversationId) {
    const { data } = await supabase
      .from('chatbot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (data) return data.id;
  }

  const { data: created, error } = await supabase
    .from('chatbot_conversations')
    .insert({
      organization_id: profile.organization_id,
      profile_id: profile.id,
      title: firstMessage.slice(0, 60),
    })
    .select('id')
    .single();
  if (error || !created) throw new Error('Could not start a conversation.');
  return created.id;
}

export async function appendMessage(params: {
  conversationId: string;
  organizationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
  status?: 'complete' | 'pending_confirmation' | 'cancelled';
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chatbot_messages')
    .insert({
      conversation_id: params.conversationId,
      organization_id: params.organizationId,
      role: params.role,
      content: params.content,
      tool_calls: params.toolCalls ?? null,
      tool_call_id: params.toolCallId ?? null,
      tool_name: params.toolName ?? null,
      tool_result: params.toolResult ?? null,
      status: params.status ?? 'complete',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('Could not save this message.');

  // A message insert doesn't touch the parent conversation row on its own —
  // bump it explicitly so loadConversation's "most recently updated" lookup
  // (used when no conversationId is given) reflects real activity.
  await supabase
    .from('chatbot_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.conversationId);

  return data.id;
}

/**
 * Reconstructs the message list the model actually sees. Two things need
 * filtering out, not just a status check:
 *  - non-'complete' messages (a pending confirmation or a cancelled draft
 *    isn't a real turn yet), and
 *  - an assistant tool-call whose result never completed (still pending, or
 *    cancelled) — both providers require every tool_use/tool_call to have a
 *    matching result in the very next turn, so a dangling one would break
 *    the next model call. Rather than dropping the whole assistant message,
 *    only the unresolved calls are stripped from it; anything before/after
 *    stays intact so the conversation can carry on normally once the user's
 *    next message arrives.
 */
export function toChatMessages(stored: StoredMessage[]): ChatMessage[] {
  const complete = stored.filter((m) => m.status === 'complete');
  const resolvedToolCallIds = new Set(
    complete.filter((m) => m.role === 'tool' && m.toolCallId).map((m) => m.toolCallId as string),
  );

  const out: ChatMessage[] = [];
  for (const m of complete) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const resolved = m.toolCalls.filter((tc) => resolvedToolCallIds.has(tc.id));
      if (resolved.length === 0 && !m.content) continue; // fully orphaned turn — drop
      out.push({ role: 'assistant', content: m.content, toolCalls: resolved.length ? resolved : undefined });
      continue;
    }
    out.push({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls ?? undefined,
      toolCallId: m.toolCallId ?? undefined,
      toolName: m.toolName ?? undefined,
    });
  }
  return out;
}
