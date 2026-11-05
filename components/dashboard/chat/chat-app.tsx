'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { isOnline } from '@/lib/chat/status';
import { useChat } from './chat-provider';
import { ChatThread } from './chat-thread';
import { NewChatDialog, GroupDialog } from './chat-dialogs';
import { Avatar } from './avatar';

export interface InboxItem {
  conversation_id: string;
  kind: 'direct' | 'group';
  name: string | null;
  other_profile_id: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  last_sender_id: string | null;
  unread_count: number;
}

export interface StaffMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'admin' | 'agent';
  is_active: boolean;
}

function listTime(iso: string | null, tz: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: tz });
  const now = new Date();
  if (day(d) === day(now)) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz });
}

/**
 * The Messages page: conversation list on the left, the open conversation
 * in the middle (ChatThread), details on the right on wide screens. On a
 * phone the list and the conversation take turns, like WhatsApp.
 */
export function ChatApp({
  me,
  isAdmin,
  initialInbox,
  staff,
  initialPresence,
  initialSelected,
  timezone,
}: {
  me: string;
  isAdmin: boolean;
  initialInbox: InboxItem[];
  staff: StaffMember[];
  initialPresence: Record<string, string>;
  initialSelected: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const chat = useChat();
  const [inbox, setInbox] = useState(initialInbox);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelected && initialInbox.some((c) => c.conversation_id === initialSelected) ? initialSelected : null,
  );
  const [presence, setPresence] = useState(initialPresence);
  const [query, setQuery] = useState('');
  const [, setNow] = useState(Date.now());
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const supabase = () => (supabaseRef.current ??= createClient());

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const refreshInbox = useCallback(async () => {
    const { data } = await supabase().rpc('chat_inbox');
    if (data) setInbox(data as InboxItem[]);
  }, []);

  // The open conversation counts as read (blue ticks for the sender).
  useEffect(() => {
    chat?.setActiveConversation(selectedId);
    return () => chat?.setActiveConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Keep the URL in step so a notification link / refresh reopens the chat.
  useEffect(() => {
    const url = selectedId ? `/messages?c=${selectedId}` : '/messages';
    window.history.replaceState(null, '', url);
  }, [selectedId]);

  // New message anywhere → refresh the list (order, preview, new chats).
  useEffect(() => {
    if (chat?.lastIncoming) void refreshInbox();
  }, [chat?.lastIncoming, refreshInbox]);

  // Live online / last seen, re-evaluated every 30s as heartbeats age.
  useEffect(() => {
    const client = supabase();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;
    client.auth.getSession().then(() => {
      if (cancelled) return;
      channel = client
        .channel(`chat-presence:${me}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_presence' }, (payload) => {
          const p = payload.new as { profile_id?: string; last_seen_at?: string };
          if (p.profile_id && p.last_seen_at) setPresence((prev) => ({ ...prev, [p.profile_id!]: p.last_seen_at! }));
        })
        .subscribe();
    });
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      clearInterval(tick);
      if (channel) client.removeChannel(channel);
    };
  }, [me]);

  const titleOf = useCallback(
    (c: InboxItem) =>
      c.kind === 'group'
        ? (c.name ?? 'Group')
        : (staffById.get(c.other_profile_id ?? '')?.full_name ?? 'Former staff'),
    [staffById],
  );

  const visible = inbox.filter((c) => !query || titleOf(c).toLowerCase().includes(query.toLowerCase()));
  const selected = inbox.find((c) => c.conversation_id === selectedId) ?? null;

  async function opened(conversationId: string) {
    await refreshInbox();
    setSelectedId(conversationId);
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100dvh-17rem)] min-h-[420px] overflow-hidden rounded-xl border border-tenant-ink/10 bg-white shadow-sm md:h-[calc(100vh-11rem)] md:min-h-[480px]">
      {/* Conversation list */}
      <aside
        className={cn(
          'flex w-full flex-col border-r border-tenant-ink/10 md:w-80 md:flex-none',
          selected && 'hidden md:flex',
        )}
      >
        <div className="space-y-3 border-b border-tenant-ink/10 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <NewChatDialog me={me} staff={staff} onOpened={opened}>
              <button
                type="button"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-tenant-accent px-3 text-sm font-medium text-white hover:bg-tenant-accent/90"
              >
                <MessageSquarePlus className="h-4 w-4" /> New chat
              </button>
            </NewChatDialog>
            {isAdmin && (
              <GroupDialog me={me} staff={staff} onSaved={opened}>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-tenant-ink/15 px-3 text-sm text-tenant-ink hover:bg-tenant-gray"
                >
                  <Users className="h-4 w-4" /> New group
                </button>
              </GroupDialog>
            )}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto" aria-label="Chats">
          {visible.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">
              {inbox.length ? 'No chats match your search.' : 'No chats yet — start one with “New chat”.'}
            </li>
          )}
          {visible.map((c) => {
            const unread = chat?.unread[c.conversation_id] ?? c.unread_count;
            const other = c.other_profile_id ? staffById.get(c.other_profile_id) : null;
            const preview = c.last_message_body
              ? `${c.last_sender_id === me ? 'You: ' : c.kind === 'group' && c.last_sender_id ? `${staffById.get(c.last_sender_id)?.full_name?.split(' ')[0] ?? 'Someone'}: ` : ''}${c.last_message_body}`
              : 'No messages yet';
            return (
              <li key={c.conversation_id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.conversation_id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-tenant-ink/5 px-3 py-3 text-left transition-colors hover:bg-tenant-gray',
                    c.conversation_id === selectedId && 'bg-tenant-accent/5',
                  )}
                >
                  <Avatar
                    name={titleOf(c)}
                    group={c.kind === 'group'}
                    online={c.kind === 'direct' && isOnline(presence[c.other_profile_id ?? ''])}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm text-tenant-ink', unread ? 'font-semibold' : 'font-medium')}>
                        {titleOf(c)}
                        {other && !other.is_active && <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>}
                      </span>
                      <span className={cn('flex-none text-xs', unread ? 'font-semibold text-tenant-accent' : 'text-muted-foreground')}>
                        {listTime(c.last_message_at, timezone)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{preview}</span>
                      {unread > 0 && (
                        <span
                          aria-label={`${unread} unread`}
                          className="flex h-5 min-w-[20px] flex-none items-center justify-center rounded-full bg-tenant-accent px-1.5 text-[11px] font-semibold text-white"
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Open conversation */}
      <section className={cn('min-w-0 flex-1', !selected && 'hidden md:flex')}>
        {selected ? (
          <ChatThread
            key={selected.conversation_id}
            conversation={selected}
            title={titleOf(selected)}
            me={me}
            isAdmin={isAdmin}
            staff={staff}
            staffById={staffById}
            presence={presence}
            timezone={timezone}
            onBack={() => setSelectedId(null)}
            onSent={(m) =>
              // Move this chat to the top with the new preview.
              setInbox((prev) => {
                const current = prev.find((c) => c.conversation_id === m.conversation_id);
                if (!current) return prev;
                const updated = { ...current, last_message_at: m.created_at, last_message_body: m.body, last_sender_id: me };
                return [updated, ...prev.filter((c) => c.conversation_id !== m.conversation_id)];
              })
            }
            onGroupSaved={opened}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MessageSquarePlus className="h-10 w-10 text-tenant-ink/20" />
            <p className="text-sm">Choose a chat, or start a new one.</p>
          </div>
        )}
      </section>
    </div>
  );
}
