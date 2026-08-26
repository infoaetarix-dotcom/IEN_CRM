import 'server-only';

/**
 * Provider-agnostic tool-calling client. Each org picks a provider *family*
 * in Super Admin (see saveChatbotConfig in app/super/actions.ts) — most LLM
 * vendors (OpenAI/ChatGPT, Grok, Gemini via Google's own OpenAI-compat
 * endpoint, DeepSeek, Groq, a self-hosted proxy, anything) speak the same
 * OpenAI chat-completions wire format, so 'openai_compatible' covers all of
 * them via a Base URL + Model the org sets, rather than a bespoke
 * integration per vendor. Anthropic's Claude is the one genuine outlier
 * (different request/response shape entirely) and gets its own native path.
 * No SDK dependency for either family — bare fetch, matching
 * lib/email/brevo.ts's convention.
 */

// Fallback only — used when an org's stored `model` is empty (e.g. a row
// saved before the model column existed). New saves always set one.
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const CLAUDE_API_VERSION = '2023-06-01';
const CLAUDE_MAX_TOKENS = 4096;

export type ChatbotProvider = 'openai_compatible' | 'claude';

export type ChatRole = 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /**
   * Vendor-specific fields on the tool_call object beyond id/type/function —
   * e.g. Gemini's OpenAI-compat layer attaches an extra_content.google.
   * thought_signature that MUST be echoed back verbatim on the next request
   * or it rejects the call with a 400 ("Function call is missing a
   * thought_signature"). Opaque here on purpose: round-tripped as-is by
   * toOpenAiMessage() below without this file needing to know what's in it.
   */
  providerExtra?: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  /** Text content. Null for an assistant turn that is tool calls only. */
  content: string | null;
  /** Present on an assistant message that called one or more tools. */
  toolCalls?: ToolCall[];
  /** Present on a 'tool' message — which call this result answers. */
  toolCallId?: string;
  /** Present on a 'tool' message — the tool that was called. */
  toolName?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  /** JSON schema for the tool's arguments object. */
  parameters: Record<string, unknown>;
}

export interface CallLLMParams {
  provider: ChatbotProvider;
  apiKey: string;
  /** Required for 'openai_compatible'; ignored for 'claude'. */
  baseUrl?: string | null;
  /** The model id to use. Falls back to a default only for 'claude'. */
  model?: string | null;
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  /**
   * Ask for a JSON-only reply with no tools bound (the paste-to-lead
   * extraction path). OpenAI-compatible vendors get a real guaranteed-JSON
   * response_format; Claude gets a strong system-prompt instruction instead
   * (Anthropic has no equivalent flag) — callers on that path should
   * tolerate a markdown-fenced reply and strip it before JSON.parse.
   */
  responseFormatJson?: boolean;
}

export interface CallLLMResult {
  content: string | null;
  toolCalls: ToolCall[];
}

export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  return params.provider === 'claude' ? callClaude(params) : callOpenAiCompatible(params);
}

// ----------------------------------------------------- OpenAI-compatible ---

async function callOpenAiCompatible(params: CallLLMParams): Promise<CallLLMResult> {
  if (!params.baseUrl) throw new Error('No base URL configured for this provider.');
  if (!params.model) throw new Error('No model configured for this provider.');

  const body: Record<string, unknown> = {
    model: params.model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      ...params.messages.map(toOpenAiMessage),
    ],
  };
  if (params.tools?.length) {
    body.tools = params.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  if (params.responseFormatJson) {
    body.response_format = { type: 'json_object' };
  }

  const endpoint = `${params.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`LLM request failed: ${err instanceof Error ? err.message : 'network error'}`);
  }
  if (!res.ok) {
    throw new Error(`LLM error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id: string; type?: string; function: { name: string; arguments: string }; [key: string]: unknown }>;
      };
    }>;
  };
  const message = data.choices?.[0]?.message;
  const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((tc) => {
    const { id, type: _type, function: _fn, ...rest } = tc;
    void _type;
    void _fn;
    return {
      id,
      name: tc.function.name,
      arguments: safeParseJsonObject(tc.function.arguments),
      providerExtra: Object.keys(rest).length ? rest : undefined,
    };
  });

  return { content: message?.content ?? null, toolCalls };
}

function toOpenAiMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content ?? '' };
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        ...(tc.providerExtra ?? {}),
      })),
    };
  }
  return { role: m.role, content: m.content ?? '' };
}

// -------------------------------------------------------------- Claude ---

async function callClaude(params: CallLLMParams): Promise<CallLLMResult> {
  const systemPrompt = params.responseFormatJson
    ? `${params.systemPrompt}\n\nRespond with ONLY a single valid JSON object — no prose, no markdown code fences, no commentary before or after it.`
    : params.systemPrompt;

  const body: Record<string, unknown> = {
    model: params.model || CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: systemPrompt,
    messages: toClaudeMessages(params.messages),
  };
  if (params.tools?.length) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': CLAUDE_API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Claude request failed: ${err instanceof Error ? err.message : 'network error'}`);
  }
  if (!res.ok) {
    throw new Error(`Claude error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >;
  };
  const blocks = data.content ?? [];
  const text = blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  const toolCalls: ToolCall[] = blocks
    .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      b.type === 'tool_use',
    )
    .map((b) => ({ id: b.id, name: b.name, arguments: b.input }));

  return { content: text || null, toolCalls };
}

/**
 * Claude requires every tool_use in an assistant turn to be answered by a
 * matching tool_result in the NEXT message, and multiple tool_results must
 * live inside one user-role message (not several consecutive ones) — so
 * consecutive 'tool' entries in our neutral list are batched together here.
 */
function toClaudeMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i]!;
    if (m.role === 'tool') {
      const block: Array<Record<string, unknown>> = [];
      while (i < messages.length && messages[i]!.role === 'tool') {
        const t = messages[i]!;
        block.push({ type: 'tool_result', tool_use_id: t.toolCallId, content: t.content ?? '' });
        i++;
      }
      out.push({ role: 'user', content: block });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const content: Array<Record<string, unknown>> = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
      }
      out.push({ role: 'assistant', content });
      i++;
      continue;
    }
    out.push({ role: m.role, content: m.content ?? '' });
    i++;
  }
  return out;
}

function safeParseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
