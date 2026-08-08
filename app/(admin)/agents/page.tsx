import { UserCog } from 'lucide-react';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { AgentsTable } from '@/components/dashboard/agents-table';
import { CreateAgentForm } from '@/components/dashboard/agent-controls';

export const metadata = { title: 'Agents — CRM' };

export default async function AgentsPage() {
  // Admin-only (defense in depth: layout guard + this + RLS).
  const admin = await requireRole('admin');
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCog}
        title="Agents & admins"
        subtitle={`${(staff ?? []).length} staff · manage accounts and access`}
        action={<CreateAgentForm />}
      />

      <AgentsTable staff={staff ?? []} currentUserId={admin.id} />
    </div>
  );
}
