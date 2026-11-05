import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireTeamChat } from '@/lib/chat/guard';
import { getReportingSettings } from '@/lib/reports/settings';
import { PageHeader } from '@/components/dashboard/page-header';
import { ChatApp, type InboxItem, type StaffMember } from '@/components/dashboard/chat/chat-app';

export const metadata = { title: 'Messages' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Team chat (opt-in module, 0051_team_chat.sql): direct chats between any
 * two staff, and group chats admins create. Everything here is visible to
 * conversation members only — RLS has no super-admin bypass for chat.
 */
export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireTeamChat();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: inbox }, { data: staff }, { data: presence }, { timezone }] = await Promise.all([
    supabase.rpc('chat_inbox'),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('organization_id', profile.organization_id)
      .order('full_name'),
    supabase.from('chat_presence').select('profile_id, last_seen_at'),
    getReportingSettings(profile.organization_id!),
  ]);

  const requested = typeof sp.c === 'string' ? sp.c : null;

  return (
    <div className="space-y-4">
      <PageHeader icon={MessageSquare} title="Messages" subtitle="Chat with your team in real time." />
      <ChatApp
        me={profile.id}
        isAdmin={profile.role === 'admin'}
        initialInbox={(inbox ?? []) as InboxItem[]}
        staff={(staff ?? []) as StaffMember[]}
        initialPresence={Object.fromEntries((presence ?? []).map((p) => [p.profile_id, p.last_seen_at]))}
        initialSelected={requested}
        timezone={timezone}
      />
    </div>
  );
}
