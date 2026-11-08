import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';
import { AETARIX, initialsFrom } from '@/lib/branding';
import { Sidebar } from '@/components/dashboard/sidebar';
import { AccountMenu } from '@/components/dashboard/account-menu';
import { NotificationsBell } from '@/components/dashboard/notifications-bell';
import { RefreshButton } from '@/components/dashboard/refresh-button';
import { FloatingChatButton } from '@/components/dashboard/chatbot/floating-button';
import { ChatProvider } from '@/components/dashboard/chat/chat-provider';
import { AppSplash } from '@/components/dashboard/app-splash';
import { AttendanceClock } from '@/components/dashboard/attendance/attendance-clock';
import { getClockState } from '@/lib/attendance/server';

/**
 * Browser-tab title and favicon for the whole tenant admin panel — the
 * consultancy's own brand, not a fixed "Aetarix CRM". Deliberately read-only
 * and best-effort (never throws/redirects): auth enforcement is the layout
 * component's job below, not metadata generation's.
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const brand = await getOrgBrand(profile?.organization_id ?? null);

  return {
    title: { default: brand.name, template: `%s — ${brand.name}` },
    icons: brand.logoUrl ? { icon: brand.logoUrl } : undefined,
  };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: redirects to /login if unauthenticated/inactive. RLS is the backstop.
  const profile = await requireUser();

  // The org CRM belongs to tenant staff. Super admins have cross-org RLS access,
  // so without this they'd land here and see every consultancy's leads merged
  // into one dashboard — their console is /super. (Covers direct navigation and
  // the middleware bounce from /login, which can't read the flag itself.)
  if (profile.is_super_admin) redirect('/super');

  // New staff must set their own password before using the CRM. The
  // /change-password page lives outside this layout, so there's no redirect loop.
  if (profile.must_change_password) redirect('/change-password');

  // Tenant brand — never hardcode a client here; consultancy #2 uses this too.
  const brand = await getOrgBrand(profile.organization_id);
  const theme = resolveTheme(brand.themeKey);

  // Which opt-in modules (e.g. Finance) this org has enabled — drives nav
  // visibility. The route itself re-checks this independently; hiding the
  // link is a UX nicety, not the access control.
  const supabase = await createClient();
  const { data: orgModules } = await supabase
    .from('organization_modules')
    .select('module_key')
    .eq('organization_id', profile.organization_id)
    .eq('enabled', true);
  const enabledModules = (orgModules ?? []).map((m) => m.module_key);

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Team chat (opt-in module): starting unread counts for the sidebar
  // badge; ChatProvider keeps them live from here.
  const chatOn = enabledModules.includes('team_chat');
  const { data: inbox } = chatOn ? await supabase.rpc('chat_inbox') : { data: null };
  const initialUnread = Object.fromEntries(
    ((inbox ?? []) as { conversation_id: string; unread_count: number }[]).map((c) => [c.conversation_id, c.unread_count]),
  );

  // Attendance (opt-in module): agents get Clock in / Clock out in the top
  // bar. Admins don't clock in; they read everyone's records on /attendance.
  const clockState =
    enabledModules.includes('attendance') && profile.role === 'agent' && profile.organization_id
      ? await getClockState({ ...profile, organization_id: profile.organization_id })
      : null;

  const page = (
    <div
      id="tenant-theme-root"
      style={themeStyleVars(theme.tokens)}
      className="bg-tenant-gray flex min-h-screen flex-col"
    >
      {/* Opening animation — part of this HTML, so it's the first thing
          painted, and it covers the page until React is ready. */}
      <AppSplash
        brand={{ name: brand.name, logoUrl: brand.logoUrl, bg: theme.tokens.navy, accent: theme.tokens.accent }}
      />

      {/* Top navbar — full width: tenant logo left, account controls right */}
      <header className="bg-tenant-navy flex h-16 flex-none items-center justify-between border-b border-white/10 p-5 md:p-10">
        <Link
          href="/dashboard"
          className="relative flex items-center rounded-lg px-3 py-2"
        >
          {/* Transparent blurred background */}
          <div className="absolute inset-0 rounded-lg bg-white/5 backdrop-blur-md" />

          {/* Logo stays sharp */}
          <div className="relative z-10">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <Image
                src={AETARIX.wordmark}
                alt={AETARIX.name}
                width={295}
                height={96}
                className="h-10 w-auto object-contain"
              />
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {clockState && <AttendanceClock initial={clockState} />}
          <RefreshButton />
          <NotificationsBell profileId={profile.id} initialNotifications={notifications ?? []} />
          <AccountMenu
            fullName={profile.full_name}
            email={profile.email}
            role={profile.role}
            initials={initialsFrom(profile.full_name)}
          />
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        {/* Icon-only sidebar */}
        <aside className="bg-tenant-navy hidden w-16 flex-none flex-col items-center px-10 py-4 md:flex">
          <Sidebar role={profile.role} enabledModules={enabledModules} />
        </aside>

        {/* Mobile nav row — icon-only, horizontal */}
        <div className="bg-tenant-navy flex items-center border-b border-white/10 py-3 md:hidden">
          <Sidebar role={profile.role} enabledModules={enabledModules} orientation="horizontal" />
        </div>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>

      {enabledModules.includes('chatbot') && <FloatingChatButton />}
    </div>
  );

  return chatOn ? (
    <ChatProvider profileId={profile.id} initialUnread={initialUnread}>
      {page}
    </ChatProvider>
  ) : (
    page
  );
}
