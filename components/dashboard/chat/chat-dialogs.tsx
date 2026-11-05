'use client';

import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { openDirectChat, createGroupChat, updateGroupChat } from '@/app/(admin)/messages/actions';
import { Avatar } from './avatar';
import type { StaffMember } from './chat-app';

/** "New chat": pick any active colleague; opens (or reuses) the direct chat. */
export function NewChatDialog({
  me,
  staff,
  onOpened,
  children,
}: {
  me: string;
  staff: StaffMember[];
  onOpened: (conversationId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const people = staff.filter(
    (s) => s.id !== me && s.is_active && (!query || (s.full_name ?? '').toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setQuery('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">New chat</DialogTitle>
          <DialogDescription>Message anyone on your team.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search colleagues…" className="pl-9" autoFocus />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {people.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No colleagues found.</li>}
          {people.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const res = await openDirectChat(s.id);
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    setOpen(false);
                    onOpened(res.conversationId);
                  })
                }
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-tenant-gray disabled:opacity-60"
              >
                <Avatar name={s.full_name ?? '?'} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-tenant-ink">{s.full_name}</span>
                  <span className="block truncate text-xs capitalize text-muted-foreground">{s.role}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Admins only: create a group, or (with `group`) rename it and change its
 * members. The database enforces the admin rule too (chat_create_group /
 * chat_update_group).
 */
export function GroupDialog({
  me,
  staff,
  group,
  onSaved,
  children,
}: {
  me: string;
  staff: StaffMember[];
  group?: { id: string; name: string; memberIds: string[] };
  onSaved: (conversationId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const people = staff.filter((s) => s.id !== me && (s.is_active || members.has(s.id)));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setName(group?.name ?? '');
          setMembers(new Set((group?.memberIds ?? []).filter((p) => p !== me)));
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">{group ? 'Edit group' : 'New group'}</DialogTitle>
          <DialogDescription>
            {group ? 'Rename the group or change who’s in it.' : 'Members can see every message sent in the group.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="group_name">Group name</Label>
            <Input id="group_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Admissions team" className="mt-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Members ({members.size} + you)</Label>
              <button
                type="button"
                className="text-xs font-medium text-tenant-accent hover:underline"
                onClick={() => setMembers(new Set(people.filter((p) => p.is_active).map((p) => p.id)))}
              >
                Select everyone
              </button>
            </div>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {people.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-tenant-gray">
                    <input
                      type="checkbox"
                      checked={members.has(s.id)}
                      onChange={(e) =>
                        setMembers((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        })
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    <Avatar name={s.full_name ?? '?'} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{s.full_name}</span>
                    <span className="text-xs capitalize text-muted-foreground">{s.role}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            disabled={pending}
            className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
            onClick={() =>
              start(async () => {
                setError(null);
                const ids = [...members];
                if (group) {
                  const res = await updateGroupChat(group.id, name, ids);
                  if (!res.ok) return setError(res.error);
                  setOpen(false);
                  onSaved(group.id);
                } else {
                  const res = await createGroupChat(name, ids);
                  if (!res.ok) return setError(res.error);
                  setOpen(false);
                  onSaved(res.conversationId);
                }
              })
            }
          >
            {pending ? 'Saving…' : group ? 'Save changes' : 'Create group'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
