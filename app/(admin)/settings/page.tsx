import { Settings } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { UniversitiesDialog } from '@/components/dashboard/settings/universities-dialog';
import { EmailSignaturesDialog } from '@/components/dashboard/settings/email-signatures-dialog';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [{ data: universities }, { data: signatures }, { data: profiles }] = await Promise.all([
    supabase
      .from('universities')
      .select('id, name, country, created_at')
      .eq('organization_id', profile.organization_id)
      .order('name'),
    supabase
      .from('email_signatures')
      .select('id, organization_id, profile_id, title, body_html, is_default, created_by, created_at, updated_at')
      .eq('organization_id', profile.organization_id)
      .order('title'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', profile.organization_id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Shared setup for your whole team."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UniversitiesDialog universities={universities ?? []} />
        <EmailSignaturesDialog
          signatures={signatures ?? []}
          profiles={profiles ?? []}
          currentProfileId={profile.id}
        />
      </div>
    </div>
  );
}
