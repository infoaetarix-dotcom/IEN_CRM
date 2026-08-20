import { Settings } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { UniversitiesDialog } from '@/components/dashboard/settings/universities-dialog';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: universities } = await supabase
    .from('universities')
    .select('id, name, country, created_at')
    .eq('organization_id', profile.organization_id)
    .order('name');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Shared setup for your whole team."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UniversitiesDialog universities={universities ?? []} />
      </div>
    </div>
  );
}
