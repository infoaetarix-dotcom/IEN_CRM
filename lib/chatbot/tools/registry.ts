import 'server-only';

import type { SessionProfile } from '@/lib/auth/guards';
import type { ToolSchema } from '@/lib/chatbot/provider';

export interface ToolContext {
  profile: SessionProfile;
}

export interface ToolExecutionResult {
  ok: boolean;
  /** Short human-readable outcome — fed back to the model as the tool result, and shown in the panel. */
  summary: string;
  /** Structured data: resolved ids for later calls in the same turn, or UI-facing payloads (a download link, a drafted message). */
  data?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON schema for the arguments object — shared shape both providers accept. */
  parameters: Record<string, unknown>;
  /**
   * True only for the two messaging tools. A confirm-gated tool's execute()
   * must never perform the actual send — only resolve/validate/draft. The
   * turn loop in app/api/chatbot/route.ts is what enforces "never executes
   * inline": it persists a pending row and stops instead of looping the
   * result back to the model.
   */
  requiresConfirmation?: boolean;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolExecutionResult>;
}

const registry = new Map<string, ToolDefinition>();

/** Each tool module calls this once, at import time, to register itself. */
export function registerTools(tools: ToolDefinition[]): void {
  for (const t of tools) registry.set(t.name, t);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function allToolSchemas(): ToolSchema[] {
  return Array.from(registry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
