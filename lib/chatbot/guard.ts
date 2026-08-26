import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser, type SessionProfile } from '@/lib/auth/guards';
import type { ChatbotProvider } from '@/lib/chatbot/provider';

export type { ChatbotProvider };

export interface ChatbotAccess {
  profile: SessionProfile;
  provider: ChatbotProvider;
  apiKey: string;
  baseUrl: string | null;
  model: string | null;
}

/**
 * Any active admin or agent may open the assistant — module-gated only, no
 * role restriction (mirrors requireStudentFinanceAccess's shape exactly).
 * This grants no extra privilege: every tool the assistant can call wraps a
 * real, already-guarded server action that independently re-derives the
 * caller's role, exactly as it would for a human clicking the same button.
 *
 * Also resolves the org's stored provider + API key. chatbot_settings has
 * no RLS policy for `authenticated` at all (see 0035_chatbot.sql), so it
 * must be read via the service-role client even though the caller's own
 * org membership is already known.
 */
export async function requireChatbotAccess(): Promise<ChatbotAccess> {
  const profile = await requireUser();

  const supabase = await createClient();
  const { data: moduleRow } = await supabase
    .from('organization_modules')
    .select('enabled')
    .eq('organization_id', profile.organization_id)
    .eq('module_key', 'chatbot')
    .maybeSingle();
  if (!moduleRow?.enabled) redirect('/dashboard');

  const service = createServiceClient();
  const { data: settings } = await service
    .from('chatbot_settings')
    .select('provider, api_key, base_url, model')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!settings?.api_key) redirect('/dashboard');

  return {
    profile,
    provider: settings.provider as ChatbotProvider,
    apiKey: settings.api_key,
    baseUrl: settings.base_url,
    model: settings.model,
  };
}
