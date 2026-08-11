'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LeadPicker } from '@/components/dashboard/lead-picker';
import { Button } from '@/components/ui/button';

/** Entry point from the Applications tab — pick a lead, then reload this page with ?lead_id= so the form pre-fills server-side. */
export function SelectLeadForApplication({
  leads,
}: {
  leads: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState('');

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose which applicant this application belongs to. Their details will
        pre-fill the form on the next step.
      </p>
      <LeadPicker
        leads={leads}
        value={leadId}
        onChange={setLeadId}
        placeholder="Select a lead…"
        allowClear={false}
      />
      <Button
        disabled={!leadId}
        className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
        onClick={() => router.push(`/applications/new?lead_id=${leadId}`)}
      >
        Continue
      </Button>
    </div>
  );
}
