'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { AgentRowControls } from '@/components/dashboard/agent-controls';

interface StaffRow {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

/** Client-side name search over the (small, org-scoped) staff list. */
export function AgentsTable({
  staff,
  currentUserId,
}: {
  staff: StaffRow[];
  currentUserId: string;
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((s) => s.full_name.toLowerCase().includes(needle));
  }, [staff, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-tenant-ink/10 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No staff match your search.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>
                  <Badge
                    variant={s.role === 'admin' ? 'accent' : 'neutral'}
                    className={
                      s.role === 'admin'
                        ? 'border-transparent bg-tenant-accent/15 text-tenant-accent'
                        : undefined
                    }
                  >
                    {s.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? 'success' : 'danger'}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <AgentRowControls
                      id={s.id}
                      isActive={s.is_active}
                      isSelf={s.id === currentUserId}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
