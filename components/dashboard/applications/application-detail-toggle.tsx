'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ApplicationForm, type ApplicationFormValues } from './application-form';

/** Read-only cards (children) until "Edit details" is clicked, then swaps to the full form — same pattern as LeadDetailsEditor. */
export function ApplicationDetailToggle({
  leadId,
  applicationId,
  initial,
  children,
}: {
  leadId: string;
  applicationId: string;
  initial: ApplicationFormValues;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <ApplicationForm
        leadId={leadId}
        applicationId={applicationId}
        initial={initial}
        onSaved={() => setEditing(false)}
      />
    </div>
  );
}
