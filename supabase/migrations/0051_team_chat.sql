-- ============================================================
-- 0051_team_chat.sql — real-time team chat between a consultancy's staff
-- ------------------------------------------------------------
-- An opt-in module ('team_chat'), switched on per org by a super admin in
-- /super/orgs/{id} like every other module. Internal staff only — direct
-- (one-to-one) chats between any two active staff, and group chats that
-- only admins create and manage.
--
-- Privacy: chats are visible to their MEMBERS ONLY. Unlike the rest of the
-- schema, none of these policies has an is_super_admin() bypass — Aetarix
-- can switch the module on or off but can never read a consultancy's chats.
-- Turning the module off hides and blocks chat (every policy and function
-- checks it) but keeps the messages; turning it back on restores them.
--
-- Ticks (WhatsApp-style) without a row per message per reader: each
-- member row carries last_delivered_at / last_read_at. A message is
-- "delivered" / "seen" for a member once their timestamp passes the
-- message's created_at. Sender's view: ✓ sent, ✓✓ delivered to all
-- others, blue ✓✓ seen by all others.
--
-- Online / last seen: chat_presence.last_seen_at, bumped by a heartbeat
-- (chat_heartbeat) while the CRM is open in a tab.
--
-- Writes that involve other people's rows (creating a chat with members,
-- marking delivered/read) go through the SECURITY DEFINER functions below,
-- each of which checks the caller, their org, the module, and membership
-- itself. Messages are inserted directly under RLS (sender = caller,
-- member of the conversation, module on).
-- ============================================================

insert into modules (key, name, description) values
  ('team_chat', 'Team chat', 'Real-time messaging between staff — direct chats, and group chats created by admins')
on conflict (key) do nothing;

-- ---------- tables ----------

create table if not exists chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind            text not null check (kind in ('direct', 'group')),
  -- Groups only.
  name            text check (name is null or length(btrim(name)) between 1 and 80),
  -- Direct only: the two profile ids, sorted and joined, so a pair can
  -- never end up with two separate direct chats.
  direct_key      text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  constraint chat_conversations_kind_shape check (
    (kind = 'direct' and direct_key is not null and name is null)
    or (kind = 'group' and direct_key is null and name is not null)
  ),
  constraint chat_conversations_direct_unique unique (organization_id, direct_key)
);

create index if not exists idx_chat_conversations_org on chat_conversations (organization_id, last_message_at desc);

create table if not exists chat_members (
  conversation_id   uuid not null references chat_conversations(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  organization_id   uuid not null references organizations(id) on delete cascade,
  joined_at         timestamptz not null default now(),
  last_delivered_at timestamptz not null default now(),
  last_read_at      timestamptz not null default now(),
  -- When this member was last emailed about this conversation — at most
  -- one email per unread streak (see lib/chat/notify.ts).
  last_emailed_at   timestamptz,
  primary key (conversation_id, profile_id)
);

create index if not exists idx_chat_members_profile on chat_members (profile_id);

create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_id       uuid references profiles(id) on delete set null,
  body            text not null check (length(btrim(body)) between 1 and 4000),
  created_at      timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation on chat_messages (conversation_id, created_at desc);

create table if not exists chat_presence (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  last_seen_at    timestamptz not null default now()
);

-- ---------- helpers (SECURITY DEFINER so policies can call them without recursion) ----------

create or replace function public.team_chat_enabled(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_modules
    where organization_id = org and module_key = 'team_chat' and enabled
  );
$$;

create or replace function public.is_chat_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from chat_members where conversation_id = conv and profile_id = auth.uid()
  );
$$;

-- The caller's org, but only if they're active staff and the module is on.
create or replace function public.chat_org() returns uuid
language sql stable security definer set search_path = public as $$
  select p.organization_id from profiles p
  where p.id = auth.uid() and p.is_active and p.organization_id is not null
    and public.team_chat_enabled(p.organization_id);
$$;

-- ---------- RLS: members only, no super-admin bypass ----------

alter table chat_conversations enable row level security;
alter table chat_members       enable row level security;
alter table chat_messages      enable row level security;
alter table chat_presence      enable row level security;

drop policy if exists chat_conversations_member_read on chat_conversations;
create policy chat_conversations_member_read on chat_conversations for select
  using (organization_id = public.chat_org() and public.is_chat_member(id));

drop policy if exists chat_members_member_read on chat_members;
create policy chat_members_member_read on chat_members for select
  using (organization_id = public.chat_org() and public.is_chat_member(conversation_id));

drop policy if exists chat_messages_member_read on chat_messages;
create policy chat_messages_member_read on chat_messages for select
  using (organization_id = public.chat_org() and public.is_chat_member(conversation_id));

drop policy if exists chat_messages_member_send on chat_messages;
create policy chat_messages_member_send on chat_messages for insert
  with check (
    organization_id = public.chat_org()
    and sender_id = auth.uid()
    and public.is_chat_member(conversation_id)
  );

drop policy if exists chat_presence_org_read on chat_presence;
create policy chat_presence_org_read on chat_presence for select
  using (organization_id = public.chat_org());

grant select on chat_conversations, chat_members, chat_presence to authenticated;
grant select, insert on chat_messages to authenticated;
grant all on chat_conversations, chat_members, chat_messages, chat_presence to service_role;

-- ---------- triggers ----------

-- A new message bumps the conversation (list order) and counts as read and
-- delivered for its sender.
create or replace function public.chat_after_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update chat_conversations set last_message_at = new.created_at where id = new.conversation_id;
  update chat_members
    set last_read_at = greatest(last_read_at, new.created_at),
        last_delivered_at = greatest(last_delivered_at, new.created_at)
    where conversation_id = new.conversation_id and profile_id = new.sender_id;
  return new;
end $$;

drop trigger if exists trg_chat_after_message on chat_messages;
create trigger trg_chat_after_message
  after insert on chat_messages
  for each row execute function public.chat_after_message();

-- ---------- functions the app calls ----------

-- Find or start the direct chat between the caller and another active
-- staff member of the same org. Returns the conversation id.
create or replace function public.chat_open_direct(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.chat_org();
  me uuid := auth.uid();
  key text;
  conv uuid;
begin
  if org is null then raise exception 'Team chat is not available'; end if;
  if other is null or other = me then raise exception 'Choose a colleague to message'; end if;
  if not exists (select 1 from profiles where id = other and organization_id = org and is_active) then
    raise exception 'That colleague is not available';
  end if;
  key := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  select id into conv from chat_conversations where organization_id = org and direct_key = key;
  if conv is null then
    insert into chat_conversations (organization_id, kind, direct_key, created_by)
      values (org, 'direct', key, me)
      on conflict (organization_id, direct_key) do nothing
      returning id into conv;
    if conv is null then
      select id into conv from chat_conversations where organization_id = org and direct_key = key;
    end if;
    insert into chat_members (conversation_id, profile_id, organization_id)
      values (conv, me, org), (conv, other, org)
      on conflict do nothing;
  end if;
  return conv;
end $$;

-- Admins only: create a group with the given members (the creator is
-- always included). Returns the conversation id.
create or replace function public.chat_create_group(group_name text, member_ids uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.chat_org();
  conv uuid;
begin
  if org is null then raise exception 'Team chat is not available'; end if;
  if not public.is_admin() then raise exception 'Only admins can create group chats'; end if;
  if group_name is null or length(btrim(group_name)) not between 1 and 80 then
    raise exception 'Enter a group name';
  end if;
  insert into chat_conversations (organization_id, kind, name, created_by)
    values (org, 'group', btrim(group_name), auth.uid())
    returning id into conv;
  insert into chat_members (conversation_id, profile_id, organization_id)
    select conv, p.id, org from profiles p
    where p.organization_id = org and p.is_active
      and (p.id = auth.uid() or p.id = any(coalesce(member_ids, '{}')))
    on conflict do nothing;
  return conv;
end $$;

-- Admins only: rename a group and set its members (admins stay in the
-- groups they manage). Removed members lose access to the group.
create or replace function public.chat_update_group(conv uuid, group_name text, member_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.chat_org();
begin
  if org is null then raise exception 'Team chat is not available'; end if;
  if not public.is_admin() then raise exception 'Only admins can manage group chats'; end if;
  if not exists (select 1 from chat_conversations where id = conv and organization_id = org and kind = 'group') then
    raise exception 'Group not found';
  end if;
  if group_name is null or length(btrim(group_name)) not between 1 and 80 then
    raise exception 'Enter a group name';
  end if;
  update chat_conversations set name = btrim(group_name) where id = conv;
  delete from chat_members
    where conversation_id = conv
      and profile_id <> auth.uid()
      and not (profile_id = any(coalesce(member_ids, '{}')));
  insert into chat_members (conversation_id, profile_id, organization_id)
    select conv, p.id, org from profiles p
    where p.organization_id = org and p.is_active
      and (p.id = auth.uid() or p.id = any(coalesce(member_ids, '{}')))
    on conflict do nothing;
end $$;

-- The caller has seen everything in a conversation up to now (blue ticks
-- for others' messages). Also clears their chat notification for it.
create or replace function public.chat_mark_read(conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.chat_org() is null or not public.is_chat_member(conv) then return; end if;
  update chat_members
    set last_read_at = now(), last_delivered_at = greatest(last_delivered_at, now())
    where conversation_id = conv and profile_id = auth.uid();
  update notifications
    set read_at = now()
    where profile_id = auth.uid() and type = 'chat_message' and read_at is null
      and link = '/messages?c=' || conv::text;
end $$;

-- Heartbeat while the CRM is open: marks the caller online and marks every
-- message waiting for them as delivered (second grey tick for senders).
-- Only touches conversations with something new, so it doesn't spam
-- realtime updates every beat.
create or replace function public.chat_heartbeat() returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.chat_org();
begin
  if org is null then return; end if;
  insert into chat_presence (profile_id, organization_id, last_seen_at)
    values (auth.uid(), org, now())
    on conflict (profile_id) do update set last_seen_at = now(), organization_id = excluded.organization_id;
  update chat_members m
    set last_delivered_at = now()
    from chat_conversations c
    where m.conversation_id = c.id and m.profile_id = auth.uid()
      and c.last_message_at is not null and m.last_delivered_at < c.last_message_at;
end $$;

-- The caller's conversation list in one round trip: each conversation with
-- its last message, the caller's unread count (others' messages after
-- their last_read_at), and for direct chats the other person.
create or replace function public.chat_inbox()
returns table (
  conversation_id   uuid,
  kind              text,
  name              text,
  other_profile_id  uuid,
  last_message_at   timestamptz,
  last_message_body text,
  last_sender_id    uuid,
  unread_count      integer
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    c.name,
    (select om.profile_id from chat_members om
      where om.conversation_id = c.id and om.profile_id <> auth.uid() limit 1),
    c.last_message_at,
    lm.body,
    lm.sender_id,
    (select count(*)::int from chat_messages x
      where x.conversation_id = c.id and x.created_at > me.last_read_at
        and x.sender_id is distinct from auth.uid())
  from chat_members me
  join chat_conversations c on c.id = me.conversation_id
  left join lateral (
    select body, sender_id from chat_messages
    where conversation_id = c.id order by created_at desc limit 1
  ) lm on true
  where me.profile_id = auth.uid()
    and c.organization_id = public.chat_org()
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

grant execute on function public.chat_inbox() to authenticated;
grant execute on function public.chat_open_direct(uuid) to authenticated;
grant execute on function public.chat_create_group(text, uuid[]) to authenticated;
grant execute on function public.chat_update_group(uuid, text, uuid[]) to authenticated;
grant execute on function public.chat_mark_read(uuid) to authenticated;
grant execute on function public.chat_heartbeat() to authenticated;

-- ---------- realtime ----------

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_members') then
    alter publication supabase_realtime add table chat_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_presence') then
    alter publication supabase_realtime add table chat_presence;
  end if;
end $$;

notify pgrst, 'reload schema';
