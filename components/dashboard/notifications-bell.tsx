'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { markNotificationRead, markAllNotificationsRead } from '@/app/(admin)/notifications/actions';
import type { Notification } from '@/lib/notifications/types';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Bell + dropdown in the admin header — live via Supabase Realtime
 * (postgres_changes on notifications, RLS-scoped to this profile), so a new
 * lead shows up instantly without a page refresh. Server-rendered initial
 * list hydrates the first paint; the subscription only ever adds to it from
 * there.
 */
export function NotificationsBell({
  profileId,
  initialNotifications,
}: {
  profileId: string;
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [, start] = useTransition();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // createBrowserClient reads the session from cookies asynchronously —
    // subscribing before that resolves sends the realtime request with no
    // JWT yet, which the RLS-gated postgres_changes filter then rejects.
    // Resolving the session first (which pushes the token into the realtime
    // client) is the documented fix.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`notifications:${profileId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${profileId}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [profileId]);

  function handleOpenNotification(n: Notification) {
    if (n.read_at) return;
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
    );
    start(() => markNotificationRead(n.id));
  }

  function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
    start(() => markAllNotificationsRead());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-tenant-offwhite transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-tenant-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        )}
        <div className="max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              asChild
              className="flex-col items-start gap-0.5 whitespace-normal py-2"
            >
              <Link href={n.link ?? '#'} onClick={() => handleOpenNotification(n)}>
                <div className="flex w-full items-center gap-2">
                  {!n.read_at && (
                    <span className="h-1.5 w-1.5 flex-none rounded-full bg-tenant-accent" />
                  )}
                  <p className={`truncate text-sm ${n.read_at ? 'font-normal' : 'font-semibold'}`}>
                    {n.title}
                  </p>
                </div>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
