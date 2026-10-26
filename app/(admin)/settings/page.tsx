import Link from 'next/link';
import { BarChart3, Settings } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { UniversitiesDialog } from '@/components/dashboard/settings/universities-dialog';
import { EmailSignaturesDialog } from '@/components/dashboard/settings/email-signatures-dialog';
import { ReportingDialog } from '@/components/dashboard/settings/reporting-dialog';
import { getReportingSettings } from '@/lib/reports/settings';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [{ data: universities }, { data: signatures }, { data: profiles }, reporting] = await Promise.all([
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
    getReportingSettings(profile.organization_id!),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Shared setup for your whole team."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/settings/reports"
          className="flex w-full items-start gap-4 rounded-xl border border-tenant-ink/10 bg-white p-5 text-left shadow-sm transition-colors hover:border-tenant-accent hover:bg-tenant-gray"
        >
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-tenant-accent/10 text-tenant-accent">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-tenant-display text-base font-semibold text-tenant-ink">Reports</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Monthly and reporting-period lead reports, and application intake reports.
            </p>
          </div>
        </Link>
        <ReportingDialog
          periods={reporting.periods}
          timezone={reporting.timezone}
          isAdmin={profile.role === 'admin' || profile.is_super_admin}
        />
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
