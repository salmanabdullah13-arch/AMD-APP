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
  ('HR'),
  -- Dedicated slot for e2e-cloud-login.js's live sign-up test — never
  -- a real person. Without this, an automated test run would
  -- permanently consume one of the 11 real identities above with a
  -- throwaway password nobody knows.
  ('E2E Test Account')
on conflict (display_name) do nothing;

-- The project's "auto-enable RLS on new tables" setting locks this
-- table down by default with zero policies — meaning nobody, not even
-- a signed-in user, could read the roster to claim a name. Needed so
-- the identity-claim screen can populate its picker.
alter table public.allowed_identities enable row level security;

-- `to public` (not just `authenticated`) — the email+password sign-up
-- form (auth.js) needs to show this roster BEFORE anyone has an
-- account yet, so a not-yet-signed-in visitor must be able to read it
-- too. Still just a list of role names, nothing sensitive.
drop policy if exists "roster is readable by any signed-in user" on public.allowed_identities;
drop policy if exists "roster is readable by anyone" on public.allowed_identities;
create policy "roster is readable by anyone"
  on public.allowed_identities for select
  to public
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

-- ══════════════════════════════════════════════════════════════
-- Phase 2, slice 1 (4 Aug 2026) — customers, the first real business
-- data table. Mirrors data.js's createCustomer()/approveCustomer()/
-- rejectCustomer() field-for-field. Unlike profiles/messages, this is
-- a shared company resource with no per-person restriction today (any
-- module can create/approve a customer) — RLS here matches that
-- exactly rather than inventing new restrictions; real role-based
-- rules are explicitly Phase 3 work, not bundled in here.
--
-- id stays client-generated ("C1508" style, unchanged from today) —
-- not moved to a server sequence. Accepted, documented tradeoff: two
-- devices creating a customer in the same instant could theoretically
-- both compute the same next code from a slightly stale local count.
-- The primary key below makes that fail loudly (a real insert
-- conflict) rather than silently corrupt data — data.js's insert
-- retries once with a fresh code if that ever happens. Not worth a
-- full server-side reservation scheme for an 11-person team; revisit
-- if it ever actually fires in practice.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.customers (
  id text primary key,
  name text not null,
  contact_person text not null,
  tel text not null,
  tel2 text not null default '',
  email text not null default '',
  fax text not null default '',
  vat_name text not null default '',
  vat_no text not null default '',
  tax_percent numeric not null default 0,
  is_credit boolean not null default false,
  credit_limit numeric not null default 0,
  credit_days integer not null default 0,
  bank_account_number text not null default '',
  bank_account_holder_name text not null default '',
  iban_number text not null default '',
  bank_swift text not null default '',
  bank_name text not null default '',
  bank_branch text not null default '',
  address text not null,
  cr_no text not null default '',
  country text not null default 'Bahrain',
  opening_balance numeric not null default 0,
  sales_man text,
  status text not null default 'pending',
  approved_by text,
  approval_date date,
  rejection_comment text,
  possible_duplicate_of text references public.customers (id),
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

-- Every logged-in user can read/create/update — matches today's app
-- exactly (no per-role restriction exists yet anywhere in this data).
drop policy if exists "customers readable by any signed-in user" on public.customers;
create policy "customers readable by any signed-in user"
  on public.customers for select to authenticated using (true);

drop policy if exists "customers insertable by any signed-in user" on public.customers;
create policy "customers insertable by any signed-in user"
  on public.customers for insert to authenticated with check (true);

drop policy if exists "customers updatable by any signed-in user" on public.customers;
create policy "customers updatable by any signed-in user"
  on public.customers for update to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- Phase 2, slice 2 (4 Aug 2026) — enquiries + quotations, the Sales
-- pipeline. Same shared-company-resource RLS as customers (any signed-
-- in user reads/writes/deletes — no per-role restriction yet, that's
-- Phase 3). Quotations' `items` (each with nested BOM: materials/
-- labour/subcontract/hiring/other) and `audit_log` are stored as
-- plain jsonb rather than fully normalized into a dozen related
-- tables — the app's own JS code already treats them as a single
-- nested object it mutates directly, and supabase-js serializes a JS
-- object to jsonb with zero mapping code needed. Full normalization
-- would be substantial extra schema/mapping work for a structure
-- that's still evolving in the app itself; jsonb gets the real win
-- (persistence, cross-device sync) without that cost.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.enquiries (
  id text primary key,
  division text not null,
  customer_id text references public.customers (id),
  prospect_name text not null default '',
  contact_person text not null,
  tel text not null,
  email text not null default '',
  requirements text not null default '',
  source text,
  sales_person text,
  date_created date not null default current_date,
  follow_ups jsonb not null default '[]'::jsonb,
  linked_quotation_id text,
  created_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;

drop policy if exists "enquiries readable by any signed-in user" on public.enquiries;
create policy "enquiries readable by any signed-in user"
  on public.enquiries for select to authenticated using (true);
drop policy if exists "enquiries insertable by any signed-in user" on public.enquiries;
create policy "enquiries insertable by any signed-in user"
  on public.enquiries for insert to authenticated with check (true);
drop policy if exists "enquiries updatable by any signed-in user" on public.enquiries;
create policy "enquiries updatable by any signed-in user"
  on public.enquiries for update to authenticated using (true) with check (true);
-- Cancelling an enquiry is a real permanent delete in this app (not a
-- status flag) — see cancelEnquiry() in data.js.
drop policy if exists "enquiries deletable by any signed-in user" on public.enquiries;
create policy "enquiries deletable by any signed-in user"
  on public.enquiries for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enquiries'
  ) then
    alter publication supabase_realtime add table public.enquiries;
  end if;
end $$;

create table if not exists public.quotations (
  id text primary key,
  rev integer not null default 0,
  enquiry_id text references public.enquiries (id),
  -- Variations (createVariationForJob() in data.js) are quotations[]
  -- entries with enquiry_id null and this set instead — jobCards
  -- itself isn't migrated yet (a later slice), so this is just a plain
  -- text id, not a foreign key to a table that doesn't exist here.
  parent_job_id text,
  customer_id text references public.customers (id),
  project_name text,
  tax_percent numeric,
  contact_person text,
  with_estimation boolean not null default true,
  notes text default '',
  items jsonb not null default '[]'::jsonb,
  covering_letter_template text,
  covering_letter_body text default '',
  terms_template text,
  terms_body text default '',
  lifecycle_status text not null default 'draft',
  stage text,
  estimator_picked_by text,
  approver_picked_by text,
  header_comment text default '',
  date date,
  confirm_date date,
  audit_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.quotations enable row level security;

drop policy if exists "quotations readable by any signed-in user" on public.quotations;
create policy "quotations readable by any signed-in user"
  on public.quotations for select to authenticated using (true);
drop policy if exists "quotations insertable by any signed-in user" on public.quotations;
create policy "quotations insertable by any signed-in user"
  on public.quotations for insert to authenticated with check (true);
drop policy if exists "quotations updatable by any signed-in user" on public.quotations;
create policy "quotations updatable by any signed-in user"
  on public.quotations for update to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quotations'
  ) then
    alter publication supabase_realtime add table public.quotations;
  end if;
end $$;
