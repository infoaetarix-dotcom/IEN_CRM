import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SuspendToggle, ModuleToggle, ThemeSelect } from '@/components/super/org-controls';
import { ChatbotConfig } from '@/components/super/chatbot-config';
import { OrgBranding } from '@/components/super/org-branding';
import { OrgDomains } from '@/components/super/org-domains';
import { OrgActivity } from '@/components/super/org-activity';
import { SendResetButton } from '@/components/super/send-reset-button';
import { brandFromOrg } from '@/lib/branding';

export default async function OrgDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, status, created_at, legal_name, logo_url, theme_key, form_domain, portal_domain',
    )
    .eq('id', id)
    .single();
  if (!org) notFound();
  const brand = brandFromOrg(org);

  const [{ data: modules }, { data: orgModules }, { data: staff }, leadsRes] =
    await Promise.all([
      supabase.from('modules').select('key, name, description').order('key'),
      supabase
        .from('organization_modules')
        .select('module_key, enabled')
        .eq('organization_id', id),
      supabase
        .from('profiles')
        .select('id, full_name, role, is_active')
        .eq('organization_id', id),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id),
    ]);

  const enabled = new Map(
    (orgModules ?? []).map((m) => [m.module_key, m.enabled]),
  );

  // Email lives on the auth user, not the profiles row — resolved via the
  // admin API, only ever from this super-admin-only page.
  const service = createServiceClient();
  const staffWithEmail = await Promise.all(
    (staff ?? []).map(async (s) => {
      const { data } = await service.auth.admin.getUserById(s.id);
      return { ...s, email: data.user?.email ?? null };
    }),
  );

  // activity_entries' RLS only grants read to the owning org's own admin —
  // deliberately no super-admin bypass, so this cross-org read goes through
  // the service role like the staff email lookups above.
  const { data: activityEntries } = await service
    .from('activity_entries')
    .select('id, category, title, description, activity_date, created_at')
    .eq('organization_id', id)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false });

  // chatbot_settings has no RLS policy for `authenticated` at all — only
  // ever read via the service role, and only ever from a super-admin-gated
  // page like this one. The raw key never leaves this query — only its
  // provider and last 4 characters (for a masked placeholder) go to the client.
  const { data: chatbotSettings } = await service
    .from('chatbot_settings')
    .select('provider, api_key, base_url, model')
    .eq('organization_id', id)
    .maybeSingle();
  const chatbotMaskedKey = chatbotSettings?.api_key
    ? chatbotSettings.api_key.slice(-4)
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/super"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-marketing-blue"
      >
        <ArrowLeft className="h-4 w-4" /> All consultancies
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-marketing-ink">
              {org.name}
            </h1>
            <Badge variant={org.status === 'active' ? 'success' : 'danger'}>
              {org.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {leadsRes.count ?? 0} leads
          </p>
        </div>
        <SuspendToggle orgId={org.id} status={org.status} />
      </div>

      <Card className="rounded-xl border-marketing-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display">Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <OrgBranding orgId={org.id} brand={brand} />
          <div className="border-t border-marketing-ink/10 pt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
              Color theme
            </p>
            <ThemeSelect orgId={org.id} themeKey={brand.themeKey} />
            <p className="mt-1 text-xs text-muted-foreground">
              Applies to their admin panel, login, and password pages.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-marketing-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display">Domains</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgDomains
            orgId={org.id}
            slug={org.slug}
            formDomain={org.form_domain}
            portalDomain={org.portal_domain}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-marketing-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display">Package — modules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(modules ?? []).map((m) =>
            m.key === 'chatbot' ? (
              <ChatbotConfig
                key={m.key}
                orgId={org.id}
                moduleName={m.name}
                enabled={enabled.get(m.key) === true}
                currentProvider={
                  (chatbotSettings?.provider as 'openai_compatible' | 'claude' | undefined) ?? null
                }
                currentBaseUrl={chatbotSettings?.base_url ?? null}
                currentModel={chatbotSettings?.model ?? null}
                maskedKey={chatbotMaskedKey}
              />
            ) : (
              <ModuleToggle
                key={m.key}
                orgId={org.id}
                moduleKey={m.key}
                moduleName={m.name}
                enabled={enabled.get(m.key) === true}
              />
            ),
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-marketing-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display">Activity log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            What you log here shows up as a read-only report in this consultancy&rsquo;s
            own CRM, once Activity Tracker is checked on above.
          </p>
          <OrgActivity orgId={org.id} entries={activityEntries ?? []} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-marketing-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Password</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffWithEmail.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={s.role === 'admin' ? 'accent' : 'neutral'}
                      className={
                        s.role === 'admin'
                          ? 'border-transparent bg-marketing-blue/15 text-marketing-blue'
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
                    <SendResetButton userId={s.id} orgId={org.id} />
                  </TableCell>
                </TableRow>
              ))}
              {staffWithEmail.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No staff yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
