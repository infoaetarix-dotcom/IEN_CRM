import { FilePlus } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { getOrgBrand } from '@/lib/branding/org';
import { PageHeader } from '@/components/dashboard/page-header';
import { QuickQueryForm } from './quick-query-form';

export const metadata = { title: 'Create query — CRM' };

export default async function NewLeadPage() {
  const profile = await requireUser();
  const brand = await getOrgBrand(profile.organization_id);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FilePlus}
        title="Create query"
        subtitle="For a query taken over the phone or in person — nothing is required, save whatever you have."
      />

      <QuickQueryForm consentName={brand.legalName} />
    </div>
  );
}
