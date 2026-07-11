'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrgStatus, toggleModule } from '@/app/super/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function SuspendToggle({
  orgId,
  status,
}: {
  orgId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const suspended = status === 'suspended';
  return (
    <Button
      size="sm"
      variant={suspended ? 'accent' : 'outline'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setOrgStatus(orgId, suspended ? 'active' : 'suspended');
          router.refresh();
        })
      }
    >
      {pending ? '…' : suspended ? 'Reactivate' : 'Suspend'}
    </Button>
  );
}

export function ModuleToggle({
  orgId,
  moduleKey,
  moduleName,
  enabled,
}: {
  orgId: string;
  moduleKey: string;
  moduleName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(enabled);
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
      <span>{moduleName}</span>
      <Checkbox
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const res = await toggleModule(orgId, moduleKey, next);
            if (!res.ok) setOn(!next); // revert on failure
            router.refresh();
          });
        }}
      />
    </label>
  );
}
