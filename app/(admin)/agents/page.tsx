import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  CreateAgentForm,
  AgentRowControls,
} from '@/components/dashboard/agent-controls';

export const metadata = { title: 'Agents — IEN CRM' };

export default async function AgentsPage() {
  // Admin-only (defense in depth: layout guard + this + RLS).
  const admin = await requireRole('admin');
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Staff</p>
          <h1 className="font-serif text-2xl">Agents &amp; admins</h1>
        </div>
        <CreateAgentForm />
      </div>

      <div className="rounded-lg border border-line bg-white">
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
            {(staff ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>
                  <Badge variant={s.role === 'admin' ? 'accent' : 'neutral'}>
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
                      role={s.role}
                      isActive={s.is_active}
                      isSelf={s.id === admin.id}
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
