import { Link2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { FormLinkCard } from '@/components/dashboard/form-link-card';

export const metadata = { title: 'Application form — CRM' };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default async function FormPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', profile.organization_id)
    .single();

  const url = `${APP_URL}/${org?.slug ?? ''}/apply`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Link2}
        title="Application form"
        subtitle="Your consultancy's own public intake link — copy it anywhere you want applicants to start."
      />
      <FormLinkCard url={url} />
    </div>
  );
}
