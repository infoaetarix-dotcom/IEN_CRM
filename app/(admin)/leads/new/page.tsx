import { requireUser } from '@/lib/auth/guards';
import { getOrgBrand } from '@/lib/branding/org';
import { QuickQueryForm } from './quick-query-form';

export const metadata = { title: 'Create query — CRM' };

export default async function NewLeadPage() {
  const profile = await requireUser();
  const brand = await getOrgBrand(profile.organization_id);

  return (
    <div className=" space-y-6">
      <div>
        <p className="label-eyebrow">Leads</p>
        <h1 className="font-serif text-2xl">Create query</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For a query taken over the phone or in person — nothing is required,
          save whatever you have.
        </p>
      </div>

      <QuickQueryForm consentName={brand.legalName} />
    </div>
  );
}
