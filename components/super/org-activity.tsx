'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';
import {
  createActivityEntry,
  updateActivityEntry,
  deleteActivityEntry,
  type SuperResult,
} from '@/app/super/actions';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ACTIVITY_CATEGORIES, type ActivityEntry } from '@/lib/activity/types';

const initial: SuperResult = { ok: false };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function EntryDialog({
  orgId,
  entry,
  trigger,
}: {
  orgId: string;
  entry?: ActivityEntry;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!entry;
  const action = isEdit
    ? updateActivityEntry.bind(null, entry.id, orgId)
    : createActivityEntry.bind(null, orgId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-marketing-ink">
            {isEdit ? 'Edit activity' : 'Log activity'}
          </DialogTitle>
          <DialogDescription>
            Visible to this consultancy&rsquo;s admin as a read-only report.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                list="activity-categories"
                defaultValue={entry?.category}
                placeholder="e.g. Instagram"
                required
              />
              <datalist id="activity-categories">
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="activity_date">Date</Label>
              <Input
                id="activity_date"
                name="activity_date"
                type="date"
                defaultValue={entry?.activity_date ?? todayISO()}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={entry?.title}
              placeholder="e.g. Reel posted — campus tour"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={entry?.description ?? ''}
              placeholder="Optional detail"
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-marketing-blue text-white hover:bg-marketing-blue/90"
              disabled={pending}
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Log activity'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrgActivity({ orgId, entries }: { orgId: string; entries: ActivityEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this activity entry? This cannot be undone.')) return;
    setDeletingId(id);
    start(async () => {
      await deleteActivityEntry(id, orgId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <EntryDialog
          orgId={orgId}
          trigger={
            <Button className="bg-marketing-blue text-white hover:bg-marketing-blue/90">
              <Plus className="mr-1 h-4 w-4" /> Log activity
            </Button>
          }
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Description</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(e.activity_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell>{e.category}</TableCell>
              <TableCell className="font-medium">{e.title}</TableCell>
              <TableCell className="max-w-[280px] truncate text-muted-foreground">
                {e.description ?? '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <EntryDialog
                    orgId={orgId}
                    entry={e}
                    trigger={
                      <button
                        type="button"
                        title="Edit"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-marketing-gray hover:text-marketing-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  <button
                    type="button"
                    title="Delete"
                    disabled={pending && deletingId === e.id}
                    onClick={() => handleDelete(e.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No activity logged yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
