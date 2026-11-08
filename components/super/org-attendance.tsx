'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { addOfficeNetwork, removeOfficeNetwork } from '@/app/super/actions';
import type { IpUsage } from '@/lib/attendance/ip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Office network for one consultancy's Attendance module. Clock-ins from
 * these IPs count as "Office"; anything else as "Remote". Set only here —
 * the consultancy can't change it. Below: recent clock-in IPs, so the office
 * line can be picked out without asking the client for it.
 */
export function OrgAttendance({
  orgId,
  moduleOn,
  networks,
  recentIps,
}: {
  orgId: string;
  moduleOn: boolean;
  networks: { id: string; network: string }[];
  /** lastUsedLabel is formatted on the server, in the org's time zone. */
  recentIps: (IpUsage & { lastUsedLabel: string })[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {!moduleOn && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The Attendance module is off for this consultancy — switch it on under Package — modules.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">Office IPs</p>
        {networks.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — every clock-in counts as Remote.</p>
        ) : (
          <ul className="space-y-1.5" aria-label="Office IPs">
            {networks.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-2 rounded-md border border-marketing-ink/10 bg-marketing-gray px-3 py-2"
              >
                <code className="text-sm text-marketing-ink">{n.network}</code>
                <button
                  type="button"
                  aria-label={`Remove ${n.network}`}
                  disabled={pending}
                  onClick={() => run(() => removeOfficeNetwork(orgId, n.id))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addOfficeNetwork(orgId, value), () => setValue(''));
        }}
      >
        <Label htmlFor="office_ip">Add office IP</Label>
        <div className="flex gap-2">
          <Input
            id="office_ip"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            placeholder="203.0.113.7"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 bg-marketing-blue text-white hover:bg-marketing-blue/90"
            disabled={pending || !value.trim()}
          >
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The office internet&rsquo;s public IP. A range like 203.0.113.0/24 also works; an IPv6
          address covers its whole /64 network.
        </p>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
          Recent clock-in IPs (last 30 days)
        </p>
        {recentIps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clock-ins yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Recent clock-in IPs">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">IP</th>
                  <th className="py-1.5 pr-3 font-medium">Agents</th>
                  <th className="py-1.5 pr-3 font-medium">Clock-ins</th>
                  <th className="py-1.5 pr-3 font-medium">Last used</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {recentIps.map((u) => (
                  <tr key={u.ip} className="border-t border-marketing-ink/10">
                    <td className="py-2 pr-3">
                      <code>{u.ip}</code>
                    </td>
                    <td className="py-2 pr-3">{u.agents}</td>
                    <td className="py-2 pr-3">{u.checkIns}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                      {u.lastUsedLabel}
                    </td>
                    <td className="py-2 text-right">
                      {u.isOffice ? (
                        <span className="text-xs font-medium text-emerald-700">Office</span>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => addOfficeNetwork(orgId, u.ip))}
                          className="whitespace-nowrap text-xs font-medium text-marketing-blue hover:underline"
                        >
                          Mark as office
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Earlier clock-ins keep the place they were recorded with; new ones use the updated list.
        </p>
      </div>
    </div>
  );
}
