-- ══════════════════════════════════════════════════════════════
-- AMD-APP — Supabase schema, Phase 1 (4 Aug 2026)
-- Real per-person login + cloud-backed Messages, replacing the
-- PIN(1994)+dropdown identity simulation and the in-memory-only
-- messages[]/REACHABLE_PEOPLE (data.js/teamcomms.js).
--
-- HOW TO RUN: paste this whole file into the Supabase dashboard's
-- SQL Editor (left sidebar) for your project, and click Run. Safe to
-- run once on a fresh project.
--
-- DESIGN NOTE — identity model:
-- REACHABLE_PEOPLE today is a mix of real named people ("Silva",
-- "Salman Abdullah") AND department/role pseudo-identities
-- ("Storekeeper", "Accounts", "Joinery Production Manager" — none of
-- these is a literal STAFF entry, they're roles someone fills). A real
-- login still needs to address messages the same way the rest of the
-- app already does — by that display name — so `messages` keeps
-- sender_name/recipient_name as text, exactly matching the shape
-- getInboxFor()/sendMessage() use today in data.js. What's NEW is that
-- a real auth.users row now backs each display name, via `profiles`,
-- so sending "as" someone requires actually being logged in as them —
-- closing the today's spoofing gap (anyone can pick any name from a
-- dropdown).
-- ══════════════════════════════════════════════════════════════

-- ── Allowed identities — the roster gate ─────────────────────────
-- Mirrors REACHABLE_PEOPLE (data.js) exactly. A profile can only claim
-- a display_name that exists here, so a new sign-up can't invent an
-- arbitrary name. Add a row here (and hire the person in real life)
-- to onboard someone new; no code change needed.
create table if not exists public.allowed_identities (
  display_name text primary key
);

insert into public.allowed_identities (display_name) values
  ('Arun Kumar'),
  ('Karthik Silva'),
  ('Silva'),
  ('Salman Abdullah'),
  ('Operations Manager'),
  ('Joinery Production Manager'),
  ('Upholstery Manager'),
  ('Painting Lead / Work Supervisor'),
  ('Storekeeper'),
  ('Accounts'),
  ('HR')
on conflict (display_name) do nothing;

-- The project's "auto-enable RLS on new tables" setting locks this
-- table down by default with zero policies — meaning nobody, not even
-- a signed-in user, could read the roster to claim a name. Needed so
-- the identity-claim screen can populate its picker.
alter table public.allowed_identities enable row level security;

drop policy if exists "roster is readable by any signed-in user" on public.allowed_identities;
create policy "roster is readable by any signed-in user"
  on public.allowed_identities for select
  to authenticated
  using (true);

-- ── Profiles — one row per real login, claims exactly one identity ──
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null unique references public.allowed_identities (display_name),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can see the roster (needed to populate "To"
-- dropdowns) — display names aren't sensitive, this just mirrors
-- REACHABLE_PEOPLE being a plain constant today.
drop policy if exists "profiles are readable by any signed-in user" on public.profiles;
create policy "profiles are readable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

-- You can only ever create/claim your OWN profile row — the unique
-- constraint on display_name means once someone claims "Silva", no one
-- else can. There is deliberately no UPDATE policy: once claimed, an
-- identity is locked to that login (matches "each person uses their
-- own device/login consistently" from the app's real usage pattern).
-- If a name genuinely needs to be reassigned (e.g. Salman leaves), do
-- it manually from the Supabase dashboard's Table Editor.
drop policy if exists "you can claim your own identity once" on public.profiles;
create policy "you can claim your own identity once"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ── Messages — mirrors data.js's messages[]/sendMessage() shape ─────
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_name text not null references public.allowed_identities (display_name),
  recipient_name text not null references public.allowed_identities (display_name),
  body text not null check (char_length(trim(body)) > 0),
  linked_type text,
  linked_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_recipient_idx on public.messages (recipient_name, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_name, created_at desc);

alter table public.messages enable row level security;

-- Read your own inbox and your own sent messages — not anyone else's.
drop policy if exists "read your own inbox and sent messages" on public.messages;
create policy "read your own inbox and sent messages"
  on public.messages for select
  to authenticated
  using (
    sender_name = (select display_name from public.profiles where id = auth.uid())
    or recipient_name = (select display_name from public.profiles where id = auth.uid())
  );

-- You can only ever send AS your own claimed identity — this is the
-- actual fix for today's spoofing gap (a dropdown letting anyone claim
-- to be anyone).
drop policy if exists "send only as your own claimed identity" on public.messages;
create policy "send only as your own claimed identity"
  on public.messages for insert
  to authenticated
  with check (
    sender_name = (select display_name from public.profiles where id = auth.uid())
  );

-- Marking a message read: only the recipient can do this, and only
-- the read flag actually changes in practice (enforced app-side; a
-- stricter column-level check isn't worth the complexity at this
-- scale).
drop policy if exists "recipient can mark their own messages read" on public.messages;
create policy "recipient can mark their own messages read"
  on public.messages for update
  to authenticated
  using (recipient_name = (select display_name from public.profiles where id = auth.uid()))
  with check (recipient_name = (select display_name from public.profiles where id = auth.uid()));

-- ── Realtime — so inboxes update live across devices, no polling ────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
