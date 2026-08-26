import 'server-only';

import type { NextRequest } from 'next/server';
import { requireChatbotAccess } from '@/lib/chatbot/guard';
import { chatSendSchema } from '@/lib/validation/chatbot';
import { buildSystemPrompt } from '@/lib/chatbot/system-prompt';
import { callLLM, type ChatMessage } from '@/lib/chatbot/provider';
import {
  loadConversation,
  getOrCreateConversation,
  appendMessage,
  toChatMessages,
} from '@/lib/chatbot/conversations';
import { getTool, allToolSchemas } from '@/lib/chatbot/tools';
import { runGuarded } from '@/lib/chatbot/run-guarded';
import type { ChatStreamEvent, ChatHistoryMessage, PendingConfirmation } from '@/lib/chatbot/types';
import type { ToolExecutionResult } from '@/lib/chatbot/tools/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A chain like "find university → create it → create the application" needs
// several rounds; capped so a confused model can't loop indefinitely.
const MAX_TOOL_ITERATIONS = 6;

/** Hydrates the panel on open with the staff member's most recent conversation. */
export async function GET() {
  const access = await requireChatbotAccess();
  const convo = await loadConversation(access.profile, undefined);

  const messages: ChatHistoryMessage[] = (convo?.messages ?? [])
    .filter((m): m is typeof m & { role: 'user' | 'assistant' } => m.role !== 'tool' && m.status === 'complete')
    .map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }));

  // A draft the user never confirmed or cancelled before closing the panel
  // last time — surfaced again so it isn't stuck invisible in the database.
  const pendingRow = (convo?.messages ?? []).find((m) => m.status === 'pending_confirmation');
  const pendingConfirmation: PendingConfirmation | null = pendingRow
    ? {
        messageId: pendingRow.id,
        tool: pendingRow.toolName ?? '',
        summary: pendingRow.content ?? '',
        draft: (pendingRow.toolResult as Record<string, unknown>) ?? {},
      }
    : null;

  return Response.json({ conversationId: convo?.id ?? null, messages, pendingConfirmation });
}

/**
 * One conversation turn — may involve several tool-calling rounds before a
 * final reply. Every tool wraps a real, already-guarded server action;
 * runGuarded() below is the safety net that turns a rejected action's
 * redirect() throw into a clean tool-result instead of hijacking this
 * response (see lib/chatbot/run-guarded.ts).
 */
export async function POST(request: NextRequest) {
  const access = await requireChatbotAccess();

  const body = await request.json().catch(() => null);
  const parsed = chatSendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]!.message }, { status: 400 });
  }
  const { conversationId: requestedId, message } = parsed.data;
  const organizationId = access.profile.organization_id!;

  const conversationId = await getOrCreateConversation(access.profile, requestedId, message);
  const tools = allToolSchemas();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await appendMessage({ conversationId, organizationId, role: 'user', content: message });

        const existing = await loadConversation(access.profile, conversationId);
        const history: ChatMessage[] = toChatMessages(existing?.messages ?? []);

        for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
          send({ type: 'status', message: iteration === 1 ? 'Thinking…' : 'Working on it…' });

          const result = await callLLM({
            provider: access.provider,
            apiKey: access.apiKey,
            baseUrl: access.baseUrl,
            model: access.model,
            systemPrompt: buildSystemPrompt(access.profile, tools.length > 0),
            messages: history,
            tools,
          });

          if (result.toolCalls.length === 0) {
            const content = result.content ?? "I don't have a response for that.";
            await appendMessage({ conversationId, organizationId, role: 'assistant', content });
            send({ type: 'final', content, conversationId });
            return;
          }

          await appendMessage({
            conversationId,
            organizationId,
            role: 'assistant',
            content: result.content,
            toolCalls: result.toolCalls,
          });
          history.push({ role: 'assistant', content: result.content, toolCalls: result.toolCalls });

          for (const call of result.toolCalls) {
            const tool = getTool(call.name);

            if (!tool) {
              const summary = `Unknown tool "${call.name}".`;
              await appendMessage({
                conversationId, organizationId, role: 'tool',
                content: summary, toolCallId: call.id, toolName: call.name,
              });
              history.push({ role: 'tool', content: summary, toolCallId: call.id, toolName: call.name });
              send({ type: 'tool_result', tool: call.name, ok: false, summary });
              continue;
            }

            const dispatch = await runGuarded(() => tool.execute(call.arguments, { profile: access.profile }));
            const execResult: ToolExecutionResult = dispatch.ok
              ? dispatch.result
              : { ok: false, summary: dispatch.error };

            if (tool.requiresConfirmation && execResult.ok) {
              // A successful draft never executes further — persist it as
              // pending and end the turn. Only a real button click (via
              // confirmChatbotAction) can turn this into an actual send.
              const messageId = await appendMessage({
                conversationId, organizationId, role: 'tool',
                content: execResult.summary, toolCallId: call.id, toolName: call.name,
                toolResult: execResult.data, status: 'pending_confirmation',
              });
              send({
                type: 'confirmation_required',
                messageId,
                tool: call.name,
                summary: execResult.summary,
                draft: execResult.data ?? {},
              });
              return;
            }

            const toolContent = JSON.stringify({ summary: execResult.summary, ...(execResult.data ?? {}) });
            await appendMessage({
              conversationId, organizationId, role: 'tool',
              content: toolContent, toolCallId: call.id, toolName: call.name, toolResult: execResult.data ?? null,
            });
            history.push({ role: 'tool', content: toolContent, toolCallId: call.id, toolName: call.name });
            send({ type: 'tool_result', tool: call.name, ok: execResult.ok, summary: execResult.summary, data: execResult.data });
          }
        }

        const fallback = "I've done what I can for now, but this is taking more steps than expected — let me know if you'd like me to continue.";
        await appendMessage({ conversationId, organizationId, role: 'assistant', content: fallback });
        send({ type: 'final', content: fallback, conversationId });
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong. Try again.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
}
