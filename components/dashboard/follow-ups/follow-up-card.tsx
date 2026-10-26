import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDueDate } from '@/lib/follow-ups/status';
import { getFollowUpsFor } from '@/lib/follow-ups/load';
import type { FollowUpTarget } from '@/app/(admin)/follow-ups/actions';
import { FollowUpButton, FollowUpTag } from './follow-up-button';

/** Follow-up section on a lead's / application's detail page, with done history. */
export async function FollowUpCard({
  target,
  name,
  todayKey,
  nameById,
}: {
  target: FollowUpTarget;
  name: string;
  todayKey: string;
  nameById: Map<string, string | null>;
}) {
  const { open, history } = await getFollowUpsFor(target.kind, target.id);
  const who = (id: string | null) => (id ? (nameById.get(id) ?? 'Former staff') : 'Someone');

  return (
    <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="font-tenant-display">Follow-up</CardTitle>
        <FollowUpButton target={target} name={name} followUp={open} todayKey={todayKey} variant="button" />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {open ? (
          <div>
            <FollowUpTag followUp={open} todayKey={todayKey} />
            {open.note && <p className="mt-1.5 text-tenant-ink">{open.note}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">No follow-up set.</p>
        )}
        {history.length > 0 && (
          <div className="border-t border-tenant-ink/10 pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-tenant-accent">Done</p>
            <ul className="space-y-1.5">
              {history.map((h) => (
                <li key={h.id} className="text-xs text-muted-foreground">
                  <span className="text-tenant-ink">{formatDueDate(h.due_date)}</span>
                  {h.note && <> · {h.note}</>} · done by {who(h.completed_by)}
                  {h.completed_at &&
                    ` on ${new Date(h.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
