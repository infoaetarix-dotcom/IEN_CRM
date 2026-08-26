-- ============================================================
-- 0035_chatbot.sql — AI Assistant module (per-org provider + API key)
-- ------------------------------------------------------------
-- Repurposes the existing, never-used 'chatbot' module row (seeded in
-- 0004_multi_tenant.sql as "Social chatbot" / IG-FB ingestion, never built)
-- into the AI Assistant feature. UPDATE, not insert — the row already
-- exists in every org's catalog.
--
-- chatbot_settings holds each org's own provider + API key, entered by a
-- super admin (never the tenant) when the module is switched on. This is
-- the first table in this app that stores a third-party API key rather
-- than an Aetarix-controlled env var, so it gets a stricter RLS policy
-- than everything else here: NO policy at all for the `authenticated`
-- role, in either direction. It is only ever read or written through the
-- service-role client, from server-only code that has already run
-- requireSuperAdmin() (writes) or requireChatbotAccess() (reads, to make
-- the LLM call). It must never reach the browser.
--
-- chatbot_conversations / chatbot_messages are private per staff member
-- (confirmed with the user) — same owner-only RLS shape as
-- student_finance/activity_entries-adjacent per-user tables elsewhere in
-- this schema. Not added to DEFAULT_MODULES — stays opt-in per org via
-- Super Admin, same as whatsapp/bulk_messaging today.
--
-- SAFE ON A LIVE TABLE: purely additive/relabeling. No org has this module
-- enabled today, so nothing changes for any tenant until a super admin
-- opts one in.
-- ============================================================

update modules
set name = 'AI Assistant',
    description = 'Grok/Claude-powered assistant: parses pasted lead text, creates/updates leads and applications, drafts messages for review, and answers software questions — scoped to the signed-in staff member''s own role and org'
where key = 'chatbot';

create table if not exists chatbot_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  provider        text not null check (provider in ('grok', 'claude')),
  api_key         text not null,
  updated_at      timestamptz not null default now()
);

create trigger trg_chatbot_settings_touch
  before update on chatbot_settings
  for each row execute function public.touch_updated_at();

alter table chatbot_settings enable row level security;

-- Deliberately no policy for `authenticated` in either direction — this
-- table is invisible to every tenant client, admin and agent alike. Only
-- the service-role client (which bypasses RLS entirely) ever touches it.
grant all on chatbot_settings to service_role;

create table if not exists chatbot_conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  title           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_chatbot_conversations_profile
  on chatbot_conversations (profile_id, updated_at desc);

create trigger trg_chatbot_conversations_touch
  before update on chatbot_conversations
  for each row execute function public.touch_updated_at();

alter table chatbot_conversations enable row level security;

drop policy if exists chatbot_conversations_owner on chatbot_conversations;
create policy chatbot_conversations_owner on chatbot_conversations for all
  using (public.is_super_admin() or profile_id = auth.uid())
  with check (public.is_super_admin() or profile_id = auth.uid());

grant select, insert, update, delete on chatbot_conversations to authenticated;
grant all on chatbot_conversations to service_role;

create table if not exists chatbot_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chatbot_conversations(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'tool')),
  content         text,
  tool_calls      jsonb,
  tool_call_id    text,
  tool_name       text,
  tool_result     jsonb,
  status          text not null default 'complete' check (status in ('complete', 'pending_confirmation', 'cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_chatbot_messages_conversation
  on chatbot_messages (conversation_id, created_at);

alter table chatbot_messages enable row level security;

-- Ownership is via the parent conversation (messages have no profile_id of
-- their own) — same indirection pattern as e.g. application notes via
-- their parent application.
drop policy if exists chatbot_messages_owner on chatbot_messages;
create policy chatbot_messages_owner on chatbot_messages for all
  using (
    public.is_super_admin()
    or exists (
      select 1 from chatbot_conversations c
      where c.id = chatbot_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from chatbot_conversations c
      where c.id = chatbot_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on chatbot_messages to authenticated;
grant all on chatbot_messages to service_role;

notify pgrst, 'reload schema';
