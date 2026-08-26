'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageBubble } from '@/components/dashboard/chatbot/message-bubble';
import { ConfirmCard } from '@/components/dashboard/chatbot/confirm-card';
import type { ChatStreamEvent, ChatHistoryMessage, PendingConfirmation } from '@/lib/chatbot/types';

type TimelineItem =
  | { kind: 'message'; id: string; role: 'user' | 'assistant'; content: string }
  | { kind: 'tool'; id: string; ok: boolean; summary: string; downloadUrl?: string }
  | { kind: 'confirm'; id: string; messageId: string; tool: string; draft: Record<string, unknown> };

/**
 * Reads the POST /api/chatbot response as newline-delimited JSON — coarse,
 * whole-event streaming (status/tool_result/confirmation_required/final/
 * error), not token deltas. See lib/chatbot/types.ts.
 */
async function* readEvents(res: Response): AsyncGenerator<ChatStreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as ChatStreamEvent;
      } catch {
        // malformed line — skip rather than break the whole stream
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer) as ChatStreamEvent;
    } catch {
      // ignore trailing partial line
    }
  }
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/chatbot')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { conversationId: string | null; messages: ChatHistoryMessage[]; pendingConfirmation: PendingConfirmation | null } | null) => {
        if (cancelled || !data) return;
        setConversationId(data.conversationId);
        const messageItems: TimelineItem[] = data.messages
          .filter((m) => m.content)
          .map((m) => ({ kind: 'message', id: m.id, role: m.role, content: m.content! }));
        if (data.pendingConfirmation) {
          messageItems.push({
            kind: 'confirm',
            id: `confirm-${data.pendingConfirmation.messageId}`,
            messageId: data.pendingConfirmation.messageId,
            tool: data.pendingConfirmation.tool,
            draft: data.pendingConfirmation.draft,
          });
        }
        setItems(messageItems);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, status]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setError(null);
    setSending(true);
    setItems((prev) => [...prev, { kind: 'message', id: `local-${Date.now()}`, role: 'user', content: text }]);
    setStatus('Thinking…');

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationId ?? undefined, message: text }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? 'Something went wrong.');
      }

      for await (const event of readEvents(res)) {
        if (event.type === 'status') {
          setStatus(event.message);
        } else if (event.type === 'tool_result') {
          setItems((prev) => [
            ...prev,
            {
              kind: 'tool',
              id: `tool-${Date.now()}-${Math.random()}`,
              ok: event.ok,
              summary: event.summary,
              downloadUrl: typeof event.data?.downloadUrl === 'string' ? event.data.downloadUrl : undefined,
            },
          ]);
        } else if (event.type === 'confirmation_required') {
          setItems((prev) => [
            ...prev,
            { kind: 'confirm', id: `confirm-${event.messageId}`, messageId: event.messageId, tool: event.tool, draft: event.draft },
          ]);
          setStatus(null);
        } else if (event.type === 'final') {
          setConversationId(event.conversationId);
          setItems((prev) => [...prev, { kind: 'message', id: `final-${Date.now()}`, role: 'assistant', content: event.content }]);
          setStatus(null);
        } else if (event.type === 'error') {
          setError(event.message);
          setStatus(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus(null);
    } finally {
      setSending(false);
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="flex h-[32rem] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-marketing-ink/10 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-tenant-navy px-4 py-3 text-tenant-offwhite">
        <p className="font-display text-sm font-semibold">AI Assistant</p>
        <button type="button" onClick={onClose} aria-label="Close assistant" className="rounded-md p-1 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loaded && items.length === 0 && !status && (
          <p className="text-center text-sm text-muted-foreground">
            Ask me how something works, or what to do next.
          </p>
        )}
        {items.map((item) => {
          if (item.kind === 'message') {
            return <MessageBubble key={item.id} role={item.role} content={item.content} />;
          }
          if (item.kind === 'tool') {
            return (
              <div key={item.id} className="flex justify-start">
                <div
                  className={`max-w-[85%] rounded-lg border px-3 py-1.5 text-xs ${
                    item.ok ? 'border-marketing-ink/10 bg-marketing-gray text-muted-foreground' : 'border-destructive/30 bg-destructive/5 text-destructive'
                  }`}
                >
                  <p>{item.summary}</p>
                  {item.downloadUrl && (
                    <a
                      href={item.downloadUrl}
                      className="mt-1 inline-flex items-center gap-1 font-medium text-tenant-accent hover:underline"
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                  )}
                </div>
              </div>
            );
          }
          return (
            <ConfirmCard
              key={item.id}
              messageId={item.messageId}
              tool={item.tool}
              draft={item.draft}
              onDone={() => removeItem(item.id)}
            />
          );
        })}
        {status && <p className="px-1 text-xs italic text-muted-foreground">{status}</p>}
        {error && <p className="px-1 text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex items-end gap-2 border-t border-marketing-ink/10 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask a question, or tell me what to do…"
          disabled={sending}
          className="min-h-[40px] flex-1 resize-none"
          rows={1}
        />
        <Button
          type="button"
          size="sm"
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-tenant-accent text-white hover:opacity-90"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
