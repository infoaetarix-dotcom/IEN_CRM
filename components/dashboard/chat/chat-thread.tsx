'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Clock, Info, Pencil, SendHorizontal, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { sendChatMessage, type ChatMessage } from '@/app/(admin)/messages/actions';
import { isOnline, lastSeenLabel, receiptsFor, tickStatus, type MemberReceipt, type TickStatus } from '@/lib/chat/status';
import { Avatar } from './avatar';
import { GroupDialog } from './chat-dialogs';
import type { InboxItem, StaffMember } from './chat-app';

type Local = ChatMessage & { pending?: boolean; failed?: boolean };

const timeOf = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });

function dayLabel(iso: string, tz: string): string {
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const d = new Date(iso);
  const now = new Date();
  if (day(d) === day(now)) return 'Today';
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
}

/** ✓ sent · ✓✓ delivered (grey) · ✓✓ seen (blue) · clock while sending. */
function Ticks({ status, pending, failed }: { status: TickStatus; pending?: boolean; failed?: boolean }) {
  if (failed) return <AlertCircle aria-label="Not sent" className="h-3.5 w-3.5 text-red-500" />;
  if (pending) return <Clock aria-label="Sending" className="h-3 w-3 text-slate-400" />;
  if (status === 'sent') return <Check aria-label="Sent" className="h-4 w-4 text-slate-400" />;
  return (
    <CheckCheck
      aria-label={status === 'read' ? 'Seen' : 'Delivered'}
      className={cn('h-4 w-4', status === 'read' ? 'text-sky-500' : 'text-slate-400')}
    />
  );
}

/**
 * One open conversation: messages (live via Supabase Realtime), WhatsApp
 * ticks on the viewer's own messages (live as other members' delivered /
 * read times change), and the composer. Enter sends; Shift+Enter is a new
 * line.
 */
export function ChatThread({
  conversation,
  title,
  me,
  isAdmin,
  staff,
  staffById,
  presence,
  timezone,
  onBack,
  onSent,
  onGroupSaved,
}: {
  conversation: InboxItem;
  title: string;
  me: string;
  isAdmin: boolean;
  staff: StaffMember[];
  staffById: Map<string, StaffMember>;
  presence: Record<string, string>;
  timezone: string;
  onBack: () => void;
  onSent: (m: ChatMessage) => void;
  onGroupSaved: (conversationId: string) => void;
}) {
  const id = conversation.conversation_id;
  const [messages, setMessages] = useState<Local[]>([]);
  const [members, setMembers] = useState<MemberReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [openReceipts, setOpenReceipts] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const supabase = () => (supabaseRef.current ??= createClient());

  const loadMembers = useCallback(async () => {
    const { data } = await supabase()
      .from('chat_members')
      .select('profile_id, last_delivered_at, last_read_at')
      .eq('conversation_id', id);
    if (data) setMembers(data as MemberReceipt[]);
  }, [id]);

  useEffect(() => {
    const client = supabase();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;

    (async () => {
      const [{ data: rows }] = await Promise.all([
        client
          .from('chat_messages')
          .select('id, conversation_id, sender_id, body, created_at')
          .eq('conversation_id', id)
          .order('created_at', { ascending: false })
          .limit(200),
        loadMembers(),
      ]);
      if (cancelled) return;
      setMessages(((rows ?? []) as Local[]).reverse());
      setLoading(false);
      await client.auth.getSession();
      if (cancelled) return;
      channel = client
        .channel(`chat-thread:${id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${id}` },
          (payload) => {
            const m = payload.new as ChatMessage;
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          },
        )
        // Others' delivered / read times → live ticks; joins/leaves → group edits.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_members', filter: `conversation_id=eq.${id}` },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              const m = payload.new as MemberReceipt;
              setMembers((prev) => prev.map((x) => (x.profile_id === m.profile_id ? { ...x, ...m } : x)));
            } else {
              void loadMembers();
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) client.removeChannel(channel);
    };
  }, [id, loadMembers]);

  // Stay pinned to the newest message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  async function send(text: string, retryOf?: string) {
    const body = text.trim();
    if (!body) return;
    setError(null);
    const tempId = retryOf ?? `tmp-${Date.now()}`;
    const temp: Local = { id: tempId, conversation_id: id, sender_id: me, body, created_at: new Date().toISOString(), pending: true };
    setMessages((prev) => (retryOf ? prev.map((m) => (m.id === retryOf ? temp : m)) : [...prev, temp]));
    if (!retryOf) setDraft('');

    const res = await sendChatMessage(id, body);
    if (!res.ok) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      setError(res.error);
      return;
    }
    // The realtime echo may already have added the real row.
    setMessages((prev) =>
      prev.some((m) => m.id === res.message.id)
        ? prev.filter((m) => m.id !== tempId)
        : prev.map((m) => (m.id === tempId ? res.message : m)),
    );
    onSent(res.message);
  }

  const memberIds = members.map((m) => m.profile_id);
  const others = memberIds.filter((p) => p !== me);
  const otherId = conversation.kind === 'direct' ? conversation.other_profile_id : null;
  const onlineOthers = others.filter((p) => isOnline(presence[p])).length;
  const subtitle =
    conversation.kind === 'direct'
      ? lastSeenLabel(presence[otherId ?? ''], new Date(), timezone)
      : `${memberIds.length} members${onlineOthers ? ` · ${onlineOthers} online` : ''}`;
  const name = (p: string | null) => (p ? (staffById.get(p)?.full_name ?? 'Former staff') : 'Someone');
  const otherActive = otherId ? staffById.get(otherId)?.is_active !== false : true;

  const grouped = useMemo(() => {
    const out: { day: string; items: Local[] }[] = [];
    for (const m of messages) {
      const day = dayLabel(m.created_at, timezone);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages, timezone]);

  return (
    <div className="flex h-full w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-tenant-ink/10 px-3 py-2.5">
          <button type="button" onClick={onBack} aria-label="Back to chats" className="rounded-md p-1.5 text-tenant-ink hover:bg-tenant-gray md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Avatar name={title} group={conversation.kind === 'group'} online={!!otherId && isOnline(presence[otherId])} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-tenant-ink">{title}</p>
            <p className={cn('truncate text-xs', subtitle === 'Online' ? 'text-emerald-600' : 'text-muted-foreground')}>{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Chat details"
            className={cn('rounded-md p-1.5 text-tenant-ink hover:bg-tenant-gray', showInfo && 'bg-tenant-gray')}
          >
            <Info className="h-5 w-5" />
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-tenant-gray/60 px-3 py-4 sm:px-6" aria-label="Messages" role="log">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
          )}
          {grouped.map((g) => (
            <div key={g.day} className="space-y-1.5">
              <div className="flex justify-center">
                <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">{g.day}</span>
              </div>
              {g.items.map((m, i) => {
                const mine = m.sender_id === me;
                const showName = conversation.kind === 'group' && !mine && g.items[i - 1]?.sender_id !== m.sender_id;
                const status = mine ? tickStatus(m.created_at, me, members) : 'read';
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className="max-w-[78%] sm:max-w-[65%]">
                      <button
                        type="button"
                        disabled={!mine || conversation.kind !== 'group' || m.pending}
                        onClick={() => setOpenReceipts((v) => (v === m.id ? null : m.id))}
                        className={cn(
                          'block w-full rounded-2xl px-3 py-2 text-left text-sm shadow-sm disabled:cursor-default',
                          mine ? 'rounded-br-md bg-tenant-accent/15 text-tenant-ink' : 'rounded-bl-md bg-white text-tenant-ink',
                        )}
                      >
                        {showName && <span className="mb-0.5 block text-xs font-semibold text-tenant-accent">{name(m.sender_id)}</span>}
                        <span className="whitespace-pre-wrap break-words">{m.body}</span>
                        <span className="ml-2 inline-flex translate-y-0.5 items-center gap-1 float-right pl-2 text-[10px] text-muted-foreground">
                          {timeOf(m.created_at, timezone)}
                          {mine && <Ticks status={status} pending={m.pending} failed={m.failed} />}
                        </span>
                      </button>
                      {m.failed && (
                        <button type="button" onClick={() => send(m.body, m.id)} className="mt-0.5 block w-full text-right text-xs text-red-600 hover:underline">
                          Not sent — tap to retry
                        </button>
                      )}
                      {openReceipts === m.id && (
                        <ul className="mt-1 space-y-0.5 rounded-lg bg-white p-2 text-xs shadow-sm" aria-label="Message info">
                          {receiptsFor(m.created_at, me, members).map((r) => (
                            <li key={r.profile_id} className="flex items-center justify-between gap-3">
                              <span className="truncate">{name(r.profile_id)}</span>
                              <span className="flex flex-none items-center gap-1 text-muted-foreground">
                                {r.state === 'read' ? 'Seen' : r.state === 'delivered' ? 'Delivered' : 'Not delivered'}
                                {r.at && ` ${timeOf(r.at, timezone)}`}
                                <Ticks status={r.state} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Composer */}
        <form
          className="border-t border-tenant-ink/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          {otherActive ? (
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Type a message"
                aria-label="Type a message"
                className="max-h-36 min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-white px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send"
                className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-tenant-accent text-white hover:bg-tenant-accent/90 disabled:opacity-40"
              >
                <SendHorizontal className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">This person is no longer active, so you can’t send new messages.</p>
          )}
        </form>
      </div>

      {/* Details */}
      {showInfo && (
        <aside className="hidden w-72 flex-none flex-col border-l border-tenant-ink/10 p-4 lg:flex" aria-label="Chat details">
          <div className="flex flex-col items-center gap-2 border-b border-tenant-ink/10 pb-4 text-center">
            <Avatar name={title} group={conversation.kind === 'group'} />
            <p className="font-semibold text-tenant-ink">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {conversation.kind === 'direct' && otherId ? (
            <dl className="space-y-3 pt-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-tenant-accent">Role</dt>
                <dd className="capitalize">{staffById.get(otherId)?.role ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-tenant-accent">Email</dt>
                <dd className="break-all">{staffById.get(otherId)?.email ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-tenant-accent">{memberIds.length} members</p>
                {isAdmin && (
                  <GroupDialog me={me} staff={staff} group={{ id, name: title, memberIds }} onSaved={onGroupSaved}>
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-tenant-accent hover:underline">
                      <Pencil className="h-3 w-3" /> Edit group
                    </button>
                  </GroupDialog>
                )}
              </div>
              <ul className="space-y-2">
                {memberIds.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <Avatar name={name(p)} size="sm" online={isOnline(presence[p])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p === me ? 'You' : name(p)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p === me ? '' : lastSeenLabel(presence[p], new Date(), timezone)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
