import { Link2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { LinkCard } from '@/components/dashboard/form-link-card';

export const metadata = { title: 'Application form' };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default async function FormPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('slug, form_domain, portal_domain')
    .eq('id', profile.organization_id)
    .single();

  const defaultFormUrl = `${APP_URL}/${org?.slug ?? ''}/apply`;
  const customFormUrl = org?.form_domain ? `https://${org.form_domain}` : null;
  const portalUrl = org?.portal_domain ? `https://${org.portal_domain}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Link2}
        title="Application form"
        subtitle="Your consultancy's own public intake link — copy it anywhere you want applicants to start."
      />
      <LinkCard
        label="Your public application form"
        url={defaultFormUrl}
        description="Share this link with prospective students, or add it to your website, ads, and social bios. Every submission comes straight into your Leads pipeline."
      />
      {customFormUrl && (
        <LinkCard
          label="Your custom form domain"
          url={customFormUrl}
          description="Set up by Aetarix — works exactly the same as the default link above, on your own domain."
        />
      )}
      {portalUrl && (
        <LinkCard
          label="Your portal link"
          url={portalUrl}
          description="Where your team signs in to the CRM on your own domain — bookmark it or share it with new staff."
        />
      )}
    </div>
  );
}
