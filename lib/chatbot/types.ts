// Shared between the server route and client chat panel — no 'server-only'
// import here, so this stays safe to pull into a 'use client' component.

/**
 * One line of newline-delimited JSON per event on the /api/chatbot POST
 * stream. Deliberately coarse (whole events, not token deltas) — this
 * codebase has no token-streaming infra to lean on.
 */
export type ChatStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'tool_result'; tool: string; ok: boolean; summary: string; data?: Record<string, unknown> }
  | { type: 'confirmation_required'; messageId: string; tool: string; summary: string; draft: Record<string, unknown> }
  | { type: 'final'; content: string; conversationId: string }
  | { type: 'error'; message: string };

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | null;
  createdAt: string;
}

/** A draft left over from a previous session that was never confirmed/cancelled. */
export interface PendingConfirmation {
  messageId: string;
  tool: string;
  summary: string;
  draft: Record<string, unknown>;
}
