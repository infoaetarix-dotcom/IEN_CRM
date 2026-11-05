'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Team chat's always-on layer, mounted on every CRM page while the module
 * is on:
 *   - heartbeat (chat_heartbeat) every 30s and when the tab comes back —
 *     keeps this person "online" and marks messages waiting for them as
 *     delivered (the sender's second grey tick);
 *   - listens for new messages (RLS limits it to this person's chats) to
 *     keep the unread counts live and mark them delivered straight away;
 *   - marks a conversation read while it's open on screen (blue ticks).
 */

interface ChatContextValue {
  profileId: string;
  unread: Record<string, number>;
  unreadTotal: number;
  /** The conversation currently open on screen, if any. */
  setActiveConversation: (id: string | null) => void;
  markRead: (conversationId: string) => void;
  /** Bumped whenever a message arrives — lets the chat page refresh its list. */
  lastIncoming: { conversationId: string; at: number } | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/** Null when the Team chat module is off for this org. */
export function useChat() {
  return useContext(ChatContext);
}

const HEARTBEAT_MS = 30_000;

export function ChatProvider({
  profileId,
  initialUnread,
  children,
}: {
  profileId: string;
  initialUnread: Record<string, number>;
  children: React.ReactNode;
}) {
  const [unread, setUnread] = useState(initialUnread);
  const [lastIncoming, setLastIncoming] = useState<ChatContextValue['lastIncoming']>(null);
  const activeRef = useRef<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const deliverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = () => (supabaseRef.current ??= createClient());

  const heartbeat = useCallback(() => {
    // Supabase queries are lazy — they only run once awaited or then()'d.
    supabase().rpc('chat_heartbeat').then(() => {});
  }, []);

  const markRead = useCallback((conversationId: string) => {
    setUnread((u) => (u[conversationId] ? { ...u, [conversationId]: 0 } : u));
    supabase().rpc('chat_mark_read', { conv: conversationId }).then(() => {});
  }, []);

  const setActiveConversation = useCallback(
    (id: string | null) => {
      activeRef.current = id;
      if (id) markRead(id);
    },
    [markRead],
  );

  useEffect(() => {
    const client = supabase();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;

    heartbeat();
    const beat = setInterval(heartbeat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      heartbeat();
      if (activeRef.current) markRead(activeRef.current);
    };
    document.addEventListener('visibilitychange', onVisible);

    // Same as the notifications bell: resolve the session first so the
    // realtime subscription carries the user's JWT (RLS-gated).
    client.auth.getSession().then(() => {
      if (cancelled) return;
      channel = client
        .channel(`chat-inbox:${profileId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
          const msg = payload.new as { conversation_id: string; sender_id: string | null };
          if (msg.sender_id === profileId) return;
          setLastIncoming({ conversationId: msg.conversation_id, at: Date.now() });
          if (activeRef.current === msg.conversation_id && document.visibilityState === 'visible') {
            markRead(msg.conversation_id);
          } else {
            setUnread((u) => ({ ...u, [msg.conversation_id]: (u[msg.conversation_id] ?? 0) + 1 }));
            // Received → delivered (second grey tick for the sender).
            if (deliverTimer.current) clearTimeout(deliverTimer.current);
            deliverTimer.current = setTimeout(heartbeat, 800);
          }
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisible);
      if (deliverTimer.current) clearTimeout(deliverTimer.current);
      if (channel) client.removeChannel(channel);
    };
  }, [profileId, heartbeat, markRead]);

  const value = useMemo<ChatContextValue>(
    () => ({
      profileId,
      unread,
      unreadTotal: Object.values(unread).reduce((a, b) => a + b, 0),
      setActiveConversation,
      markRead,
      lastIncoming,
    }),
    [profileId, unread, setActiveConversation, markRead, lastIncoming],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
