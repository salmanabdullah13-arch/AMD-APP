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
  ('E2E Test Account'),
  -- Dedicated slot for e2e-signup-approval.js/e2e-role-gating.js (5 Aug
  -- 2026) — a pre-approved user_type='owner' fixture used ONLY to
  -- perform the approve/reject action on throwaway pending test
  -- accounts. Kept separate from 'E2E Test Account' (a plain
  -- user_type='sales' account four OTHER live-cloud tests already
  -- depend on) so correcting/testing this one's role never risks
  -- disturbing those.
  ('E2E Approver Account'),
  -- Dedicated slot for e2e-jobcards-dept-scope-rls.js (5 Aug 2026) — a
  -- pre-approved user_type='joinery_production_manager' fixture, the
  -- first live E2E account typed to a department-scoped production
  -- role (E2E Test Account is 'sales'/commercial, E2E Approver Account
  -- is 'owner' — neither is restricted by job_cards' department
  -- scoping, so neither could actually verify it).
  ('E2E Joinery Account')
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

-- Shared approver hat (15 Aug 2026). Operations approves a quote up to
-- QUOTE_APPROVAL_THRESHOLD; above it Operations RECOMMENDS and the Owner
-- counter-signs. Added as alters, not columns in the create above, because
-- `create table if not exists` is a no-op on the live table — a new column
-- in that block would never reach a project that already has it.
--
-- These carry REAL approval state. Without them a recommendation persists
-- with its state silently dropped, so a reload empties the Owner's
-- sign-off inbox and the quote reads as a plain draft again. Same class of
-- bug as the parent_job_id gap caught in Phase 2 slice 2.
alter table public.quotations add column if not exists owner_review_status  text;
alter table public.quotations add column if not exists recommended_by       text;
alter table public.quotations add column if not exists recommended_date     date;
alter table public.quotations add column if not exists counter_signed_by    text;
alter table public.quotations add column if not exists counter_signed_date  date;

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

-- ══════════════════════════════════════════════════════════════
-- Phase 2, slice 3 (4 Aug 2026) — jobCards, Q-Pro's commercial Job Card
-- wrapper (Job No, linked Quotation, delivery/materials/labour tracking,
-- department routing + 3-tier budget approval). Same shared-company-
-- resource RLS pattern as customers/enquiries/quotations.
--
-- Deliberately SCOPED OUT of this slice: curtainJobs[]/projects[] — the
-- pre-existing Curtain workshop production tracker (windows, install
-- scheduling, QC, BOM, wastage) and the Operations dashboard's rollup
-- array. Those hold real independent state written directly across
-- curtain.js's ~5,900 lines with no central persist path today; Salman's
-- explicit call (4 Aug 2026) was to migrate jobCards[] alone now and
-- leave that unification as a separate, dedicated slice — same
-- "bridge, not merge" discipline as bridgeJobToOperationsAndCurtain()
-- itself already applies in data.js. Consequence, accepted: Curtain's
-- window/install/QC/BOM progress still resets to the two frozen fixture
-- jobs on every reload after this slice ships; everything jobCards[]
-- itself owns (amount, routing, department budgets, deliveries,
-- materials moves, labour cost entries, linked invoices) now persists
-- and syncs live across devices.
--
-- `items` (per-line qty/rate/amount plus nested departmentStatuses[]),
-- `department_budgets` (per-department nested BOM + approval + actual),
-- `delivery_notes`, `materials_issues`, `materials_returns`, and
-- `labour_cost_entries` are jsonb for the same reason quotations.items
-- is — the app's own JS already treats each as one mutable object graph
-- it reads/writes directly, and supabase-js round-trips a JS
-- object/array to jsonb with zero mapping code.
--
-- No delete policy — a Job Card is never deleted in this app, only
-- cancelled via job.status (see setJobStatus() in data.js).
-- ══════════════════════════════════════════════════════════════
create table if not exists public.job_cards (
  id text primary key,
  quotation_id text references public.quotations (id),
  customer_id text references public.customers (id),
  project_name text,
  date date,
  amount numeric not null default 0,
  status text not null default 'open',
  confirm_date date,
  items jsonb not null default '[]'::jsonb,
  po_no text,
  po_date date,
  vendor text,
  delivery_notes jsonb not null default '[]'::jsonb,
  materials_issues jsonb not null default '[]'::jsonb,
  materials_returns jsonb not null default '[]'::jsonb,
  labour_cost_entries jsonb not null default '[]'::jsonb,
  linked_invoice_ids jsonb not null default '[]'::jsonb,
  variation_ids jsonb not null default '[]'::jsonb,
  routing_confirmed boolean not null default false,
  routing_confirmed_by text,
  routing_confirmed_date date,
  department_budgets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.job_cards enable row level security;

drop policy if exists "job_cards readable by any signed-in user" on public.job_cards;
create policy "job_cards readable by any signed-in user"
  on public.job_cards for select to authenticated using (true);
drop policy if exists "job_cards insertable by any signed-in user" on public.job_cards;
create policy "job_cards insertable by any signed-in user"
  on public.job_cards for insert to authenticated with check (true);
drop policy if exists "job_cards updatable by any signed-in user" on public.job_cards;
create policy "job_cards updatable by any signed-in user"
  on public.job_cards for update to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_cards'
  ) then
    alter publication supabase_realtime add table public.job_cards;
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- Phase 1 of the role-based access plan (5 Aug 2026) — role-based
-- sign-up + per-role dashboards. Replaces "pick your name off a fixed
-- 11-identity roster" (the actual access gate today) with a real
-- self-service registration form (Full Name/DOB/Phone/Designation/User
-- Type) gated by Owner/HR approval before the account can do anything —
-- approval is enforced here in RLS, not just hidden in the UI, since
-- anyone with a valid Supabase session can call the REST API directly
-- regardless of what the nav shows.
--
-- Deliberately NOT in scope: per-role table restrictions (e.g. Sales
-- literally blocked from reading Accounts' data) — that's the much
-- bigger 27-role x N-table matrix, flagged as future Phase 3 work. This
-- pass adds exactly one new hard boundary — approved vs. pending/
-- rejected — applied uniformly across every existing table. Which
-- DASHBOARD a role sees is enforced client-side (index.html/shell.js),
-- same honesty-level as today's per-role module split.
-- ══════════════════════════════════════════════════════════════

-- ── user_types — the 27-role taxonomy + Owner, replaces "your display
-- name IS your role" (several of the 11 legacy identities are literally
-- role names used as login names — a shortcut that only worked with one
-- person per role). dashboard_node_id is null for roles whose dedicated
-- dashboard isn't built yet (Milestones B-E) — those route to a plain
-- placeholder screen client-side, never a manager's full dashboard.
create table if not exists public.user_types (
  key text primary key,
  label text not null,
  dashboard_node_id text,
  department text not null
);

insert into public.user_types (key, label, dashboard_node_id, department) values
  ('sales', 'Sales', 'sales', 'commercial'),
  ('estimator', 'Estimator', 'estimation', 'commercial'),
  ('approver', 'Approver', 'approvals', 'commercial'),
  ('accounts', 'Accounts', 'accounts', 'commercial'),
  ('operations_manager', 'Operations Manager', 'operations', 'operations'),
  ('storekeeper', 'Storekeeper', 'storekeeper', 'operations'),
  ('purchaser', 'Purchaser', 'purchasing', 'operations'),
  -- dashboard_node_id filled in for Milestone E (5 Aug 2026) — see the
  -- NODES entries in index.html.
  ('vehicle_fleet_inspector', 'Vehicle Fleet Inspector', 'fleet', 'operations'),
  ('delivery_scheduling', 'Delivery / Scheduling', 'delivery-scheduling', 'operations'),
  ('hr', 'HR', 'hr', 'operations'),
  -- dashboard_node_id filled in for Milestone D (5 Aug 2026) — see the
  -- NODES entries in index.html. Assistant Production Manager
  -- deliberately shares the Production Manager's own node (management-
  -- tier role, not a shop-floor one — see the design note in data.js).
  -- Site/Floor Supervisor and Team Leader deliberately share ONE node
  -- (joinery-floor) — same design note, no real basis to differentiate
  -- these three today.
  -- 23 Aug 2026: both point at 'production' (the 19a module), not the old
  -- 'joinery' pipeline wrapper. The line 545 on-conflict clause updates
  -- dashboard_node_id, so a re-run keeps this rather than reverting it.
  ('joinery_production_manager', 'Joinery Production Manager', 'production', 'joinery'),
  ('joinery_assistant_production_manager', 'Assistant Production Manager', 'production', 'joinery'),
  ('joinery_site_supervisor', 'Site Supervisor', 'joinery-floor', 'joinery'),
  ('joinery_floor_supervisor', 'Floor Supervisor', 'joinery-floor', 'joinery'),
  ('joinery_draftsman', 'Draftsman', 'joinery-drafting', 'joinery'),
  ('joinery_team_leader', 'Team Leader', 'joinery-floor', 'joinery'),
  ('joinery_cutting_list_team', 'Cutting List Team', 'joinery-cutting', 'joinery'),
  ('joinery_veneer_pressing_team', 'Veneer Pressing Team', 'joinery-veneer-pressing', 'joinery'),
  ('painting_lead', 'Painting Lead / Work Supervisor', 'painting', 'painting'),
  ('curtain_manager', 'Curtain Manager', 'curtain', 'curtain'),
  -- dashboard_node_id filled in for Milestone B (5 Aug 2026) — see the
  -- NODES entries in index.html.
  ('curtain_tracks_team', 'Tracks Team', 'curtain-tracks', 'curtain'),
  ('curtain_qc_team', 'QC Team', 'curtain-qc', 'curtain'),
  ('curtain_team_leader', 'Team Leader', 'curtain-pipeline', 'curtain'),
  ('curtain_site_installer', 'Site Installer', 'curtain-install', 'curtain'),
  ('upholstery_manager', 'Upholstery Manager', 'upholstery', 'upholstery'),
  -- dashboard_node_id filled in for Milestone C (5 Aug 2026) — see the
  -- NODES entries in index.html.
  ('upholstery_team_leader', 'Team Leader', 'upholstery-team-leader', 'upholstery'),
  ('upholstery_qc_packaging_team', 'QC / Packaging Team', 'upholstery-qc-packaging', 'upholstery'),
  ('owner', 'Owner', 'owner', 'owner'),
  -- Nav overhaul Phase 2 (5 Aug 2026) — system administration: approvals,
  -- user/role management, and a developer-preview tool to jump into any
  -- built dashboard for QA. Gets the same full wildcard treatment as
  -- 'owner' everywhere that's checked (see is_owner_or_hr()/
  -- is_accounts_or_owner()/caller_job_department_key() below and
  -- nodeAccessible() in index.html) — one trusted person holds both
  -- roles today, so a half-working read-only preview would just get in
  -- the way of real QA.
  ('admin', 'Admin', 'admin', 'admin')
on conflict (key) do update set label = excluded.label, dashboard_node_id = excluded.dashboard_node_id, department = excluded.department;

alter table public.user_types enable row level security;
drop policy if exists "user_types readable by anyone" on public.user_types;
create policy "user_types readable by anyone"
  on public.user_types for select
  to public
  using (true);

-- ── profiles gets the new registration fields + the approval gate ──
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists designation text;
alter table public.profiles add column if not exists user_type text references public.user_types (key);
-- Fail-closed default: any insert that doesn't explicitly set this
-- (i.e. every new real sign-up) starts pending. The 11 pre-existing
-- accounts are explicitly grandfathered to 'approved' below — this
-- default only matters for rows inserted from here on.
alter table public.profiles add column if not exists approval_status text not null default 'pending';
alter table public.profiles add column if not exists approved_by text;
alter table public.profiles add column if not exists approved_date date;

-- Grandfather the pre-existing accounts so this rollout doesn't lock
-- anyone currently working out. Best-guess user_type mapping — several
-- of these guesses are approximate (Arun Kumar/Karthik Silva didn't
-- have a formal role captured anywhere before now); Owner can correct
-- any of them via the new approval/edit screen. `where user_type is
-- null` makes this safe to re-run — it only ever touches un-migrated rows.
update public.profiles set
  user_type = case display_name
    when 'Salman Abdullah' then 'owner'
    when 'Operations Manager' then 'operations_manager'
    when 'Joinery Production Manager' then 'joinery_production_manager'
    when 'Arun Kumar' then 'joinery_production_manager'
    when 'Karthik Silva' then 'joinery_team_leader'
    when 'Silva' then 'curtain_manager'
    when 'Upholstery Manager' then 'upholstery_manager'
    when 'Painting Lead / Work Supervisor' then 'painting_lead'
    when 'Storekeeper' then 'storekeeper'
    when 'Accounts' then 'accounts'
    when 'HR' then 'hr'
    else 'sales'
  end,
  approval_status = 'approved',
  approved_by = 'Migration (Phase 1 rollout, 5 Aug 2026)',
  approved_date = current_date
where user_type is null;

alter table public.profiles alter column user_type set not null;

-- ── RLS helper functions — security definer so a policy on ANY table
-- can check the caller's approval/role without needing its own separate
-- read access to profiles. search_path pinned to public, the standard
-- guard against search-path hijacking on security definer functions.
create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved'
  );
$$;

create or replace function public.is_owner_or_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved' and user_type in ('owner', 'hr', 'admin')
  );
$$;

-- ── profiles policies — rebuilt for the approval workflow. A user can
-- always read their OWN row (needed to see their own pending/rejected
-- status before they're approved for anything else); once approved,
-- they can read everyone's (roster/messaging/approval-queue). Insert is
-- still "only your own id", now also pinned to approval_status =
-- 'pending' — otherwise a self-registering user could simply insert
-- their own row with approval_status: 'approved' and skip the whole
-- gate. Update is new: only an already-approved owner/hr can update
-- ANY profile (the approval queue's actual write path) — there is
-- still no self-service profile edit for anyone else.
drop policy if exists "profiles are readable by any signed-in user" on public.profiles;
drop policy if exists "profiles are readable by own row or once approved" on public.profiles;
create policy "profiles are readable by own row or once approved"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_approved());

drop policy if exists "you can claim your own identity once" on public.profiles;
create policy "you can claim your own identity once"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and approval_status = 'pending');

drop policy if exists "owner or hr can update any profile for approval" on public.profiles;
create policy "owner or hr can update any profile for approval"
  on public.profiles for update
  to authenticated
  using (public.is_owner_or_hr())
  with check (true);

-- ── allowed_identities gets an insert policy — sign-up is no longer a
-- picker over this table, but messages.sender_name/recipient_name still
-- FK-reference it, so a fresh sign-up needs to be able to add its own
-- typed Full Name here before its profiles row can be inserted. Kept
-- deliberately open (`with check (true)`) — worst case is a junk name
-- that can only ever be a messaging participant, not a security issue,
-- and simpler than threading approval state through this table too.
drop policy if exists "signed-up users can register their own display name" on public.allowed_identities;
create policy "signed-up users can register their own display name"
  on public.allowed_identities for insert
  to authenticated
  with check (true);

-- ── Approval gate applied uniformly to every existing business table.
-- Same policies as before, each now additionally requiring
-- public.is_approved() — a pending or rejected account can read/write
-- NOTHING here, enforced at the database, not just hidden in the UI.
drop policy if exists "customers readable by any signed-in user" on public.customers;
create policy "customers readable by any signed-in user"
  on public.customers for select to authenticated using (public.is_approved());
drop policy if exists "customers insertable by any signed-in user" on public.customers;
create policy "customers insertable by any signed-in user"
  on public.customers for insert to authenticated with check (public.is_approved());
drop policy if exists "customers updatable by any signed-in user" on public.customers;
create policy "customers updatable by any signed-in user"
  on public.customers for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "enquiries readable by any signed-in user" on public.enquiries;
create policy "enquiries readable by any signed-in user"
  on public.enquiries for select to authenticated using (public.is_approved());
drop policy if exists "enquiries insertable by any signed-in user" on public.enquiries;
create policy "enquiries insertable by any signed-in user"
  on public.enquiries for insert to authenticated with check (public.is_approved());
drop policy if exists "enquiries updatable by any signed-in user" on public.enquiries;
create policy "enquiries updatable by any signed-in user"
  on public.enquiries for update to authenticated using (public.is_approved()) with check (public.is_approved());
drop policy if exists "enquiries deletable by any signed-in user" on public.enquiries;
create policy "enquiries deletable by any signed-in user"
  on public.enquiries for delete to authenticated using (public.is_approved());

drop policy if exists "quotations readable by any signed-in user" on public.quotations;
create policy "quotations readable by any signed-in user"
  on public.quotations for select to authenticated using (public.is_approved());
drop policy if exists "quotations insertable by any signed-in user" on public.quotations;
create policy "quotations insertable by any signed-in user"
  on public.quotations for insert to authenticated with check (public.is_approved());
drop policy if exists "quotations updatable by any signed-in user" on public.quotations;
create policy "quotations updatable by any signed-in user"
  on public.quotations for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "job_cards readable by any signed-in user" on public.job_cards;
create policy "job_cards readable by any signed-in user"
  on public.job_cards for select to authenticated using (public.is_approved());
drop policy if exists "job_cards insertable by any signed-in user" on public.job_cards;
create policy "job_cards insertable by any signed-in user"
  on public.job_cards for insert to authenticated with check (public.is_approved());
drop policy if exists "job_cards updatable by any signed-in user" on public.job_cards;
create policy "job_cards updatable by any signed-in user"
  on public.job_cards for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "read your own inbox and sent messages" on public.messages;
create policy "read your own inbox and sent messages"
  on public.messages for select
  to authenticated
  using (
    public.is_approved() and (
      sender_name = (select display_name from public.profiles where id = auth.uid())
      or recipient_name = (select display_name from public.profiles where id = auth.uid())
    )
  );
drop policy if exists "send only as your own claimed identity" on public.messages;
create policy "send only as your own claimed identity"
  on public.messages for insert
  to authenticated
  with check (
    public.is_approved() and
    sender_name = (select display_name from public.profiles where id = auth.uid())
  );
drop policy if exists "recipient can mark their own messages read" on public.messages;
create policy "recipient can mark their own messages read"
  on public.messages for update
  to authenticated
  using (public.is_approved() and recipient_name = (select display_name from public.profiles where id = auth.uid()))
  with check (public.is_approved() and recipient_name = (select display_name from public.profiles where id = auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- Password reset requests (5 Aug 2026) — there is no self-service
-- password reset in this app (fake @amd-app.internal addresses can't
-- receive a real reset email — see auth.js's header note) and no
-- in-app way for a locked-out, NOT-signed-in user to send a Message
-- (sendMessage()'s RLS requires auth.uid(), which a signed-out user
-- doesn't have). This table is the one thing an unauthenticated user
-- genuinely needs to write: "it's me, I'm locked out." Owner/HR see
-- and resolve these manually (via the Supabase dashboard or asking
-- an admin with API access) — this is a NOTIFICATION, not an actual
-- self-service reset.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.password_reset_requests (
  id bigint generated always as identity primary key,
  display_name text not null,
  requested_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_by text,
  resolved_date date
);

alter table public.password_reset_requests enable row level security;

-- Deliberately `to public` (covers a signed-out session too) — the
-- entire point is a locked-out user has no auth.uid() yet.
drop policy if exists "anyone can request a password reset" on public.password_reset_requests;
create policy "anyone can request a password reset"
  on public.password_reset_requests for insert
  to public
  with check (true);

drop policy if exists "owner or hr can view reset requests" on public.password_reset_requests;
create policy "owner or hr can view reset requests"
  on public.password_reset_requests for select
  to authenticated
  using (public.is_owner_or_hr());

drop policy if exists "owner or hr can resolve reset requests" on public.password_reset_requests;
create policy "owner or hr can resolve reset requests"
  on public.password_reset_requests for update
  to authenticated
  using (public.is_owner_or_hr())
  with check (public.is_owner_or_hr());

-- ══════════════════════════════════════════════════════════════
-- Phase 3 (5 Aug 2026) — server-side enforcement of the pricing-lock
-- rule. Real incident: Sales staff previously used an editable-price
-- field on quotations to defraud the company (see the "pricing-lock"
-- feedback memory — this is a documented, non-negotiable fraud-
-- prevention rule, not a UX preference). addQuotationItem()/data.js
-- already zeroes rate/amount for Sales client-side (withEstimation is
-- always true — no opt-out), but until now RLS placed zero restriction
-- on quotations UPDATE beyond "any approved user" — a Sales-role login
-- could call the Supabase REST API directly and write any price into
-- any quotation, completely bypassing the client. This closes that gap
-- at the database itself.
--
-- Implemented as a BEFORE UPDATE trigger, not a plain RLS policy,
-- because the restriction is field-level within a jsonb column
-- (items[].rate/.amount/etc.), not row-level — RLS alone can only gate
-- whether a role can touch a ROW at all, not which JSON keys inside it
-- changed.
--
-- GOTCHA (hit and fixed live, 5 Aug 2026): addQuotationItem() always
-- sets bom to JSON null (not an absent key) on a fresh line. In
-- Postgres, `jsonb_column -> 'key'` on a JSON null VALUE returns a
-- jsonb null, which is NOT sql NULL — `is not null` on it evaluates
-- true, so an early version of this trigger wrongly rejected every
-- brand-new zero-priced line Sales added. jsonb_typeof() is the
-- correct absent-vs-null-vs-object test; used below.
-- ══════════════════════════════════════════════════════════════
create or replace function public.enforce_quotation_pricing_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_type text;
  new_item jsonb;
  old_item jsonb;
begin
  select user_type into caller_type from public.profiles where id = auth.uid();
  if caller_type is distinct from 'sales' then
    return new; -- only the Sales role is restricted here
  end if;

  for new_item in select value from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) as value
  loop
    select value into old_item from jsonb_array_elements(coalesce(old.items, '[]'::jsonb)) as value
      where value->>'lineId' = new_item->>'lineId';

    if old_item is null then
      -- a brand-new line Sales is adding — must start with zero pricing
      if coalesce((new_item->>'rate')::numeric, 0) <> 0
         or coalesce((new_item->>'amount')::numeric, 0) <> 0
         or coalesce((new_item->>'netAmount')::numeric, 0) <> 0
         or coalesce(jsonb_typeof(new_item->'bom'), 'null') <> 'null' then
        raise exception 'Sales cannot set pricing on a quotation line — pricing must go through the Estimator.';
      end if;
    else
      if coalesce((new_item->>'rate')::numeric, 0) is distinct from coalesce((old_item->>'rate')::numeric, 0)
         or coalesce((new_item->>'amount')::numeric, 0) is distinct from coalesce((old_item->>'amount')::numeric, 0)
         or coalesce((new_item->>'discAmt')::numeric, 0) is distinct from coalesce((old_item->>'discAmt')::numeric, 0)
         or coalesce((new_item->>'netAmount')::numeric, 0) is distinct from coalesce((old_item->>'netAmount')::numeric, 0)
         or coalesce((new_item->>'discPercent')::numeric, 0) is distinct from coalesce((old_item->>'discPercent')::numeric, 0)
         or coalesce((new_item->>'vatPercent')::numeric, 0) is distinct from coalesce((old_item->>'vatPercent')::numeric, 0)
         or (new_item->'bom') is distinct from (old_item->'bom') then
        raise exception 'Sales cannot modify pricing on a quotation line — pricing must go through the Estimator.';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists quotation_pricing_lock on public.quotations;
create trigger quotation_pricing_lock
  before update on public.quotations
  for each row
  execute function public.enforce_quotation_pricing_lock();

-- ══════════════════════════════════════════════════════════════
-- Phase 3, second slice (5 Aug 2026) — restrict customer bank/payment
-- details to Accounts/Owner. Confirmed via code search: Sales entered
-- these on the intake form (sales.js), but customers' SELECT policy
-- above lets ANY approved user read them, including every shop-floor/
-- production role. Salman's explicit call (the "tightest" of the
-- options offered): Accounts + Owner only, accepting the real workflow
-- change — Sales' intake form loses these 6 fields; Accounts fills them
-- in afterward via a new "Customer Banking Details" tool (accounts.js).
--
-- Implemented as a SEPARATE table with its own RLS, not a masking view
-- over customers — Supabase Realtime's postgres_changes broadcasts full
-- row changes from the base table regardless of any view on top of it,
-- so a view alone would still leak these fields over the existing
-- customers realtime channel. This is the only approach that's both
-- real protection and leaves that channel untouched.
--
-- The migration below moved any existing bank data into this table
-- (verified live, 5 Aug 2026: 0 customers had any bank field filled in
-- at the time — zero data-loss risk) and the six bank_*/iban_number
-- columns were then DROPPED from customers entirely — leaving them in
-- place would still let anyone read them via customers' own
-- unrestricted SELECT policy above, defeating the whole point.
-- ══════════════════════════════════════════════════════════════
create table if not exists public.customer_banking_details (
  customer_id text primary key references public.customers (id) on delete cascade,
  bank_account_number text not null default '',
  bank_account_holder_name text not null default '',
  iban_number text not null default '',
  bank_swift text not null default '',
  bank_name text not null default '',
  bank_branch text not null default '',
  updated_by text,
  updated_date date
);

alter table public.customer_banking_details enable row level security;

create or replace function public.is_accounts_or_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved' and user_type in ('accounts', 'owner', 'admin')
  );
$$;

drop policy if exists "accounts or owner can read banking details" on public.customer_banking_details;
create policy "accounts or owner can read banking details"
  on public.customer_banking_details for select
  to authenticated
  using (public.is_accounts_or_owner());

drop policy if exists "accounts or owner can insert banking details" on public.customer_banking_details;
create policy "accounts or owner can insert banking details"
  on public.customer_banking_details for insert
  to authenticated
  with check (public.is_accounts_or_owner());

drop policy if exists "accounts or owner can update banking details" on public.customer_banking_details;
create policy "accounts or owner can update banking details"
  on public.customer_banking_details for update
  to authenticated
  using (public.is_accounts_or_owner())
  with check (public.is_accounts_or_owner());

-- One-time migration — safe to re-run (on conflict do nothing), a no-op
-- once the bank_* columns below no longer exist on customers.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'bank_account_number') then
    insert into public.customer_banking_details
      (customer_id, bank_account_number, bank_account_holder_name, iban_number, bank_swift, bank_name, bank_branch)
    select id, bank_account_number, bank_account_holder_name, iban_number, bank_swift, bank_name, bank_branch
    from public.customers
    where coalesce(bank_account_number, '') <> '' or coalesce(bank_account_holder_name, '') <> ''
       or coalesce(iban_number, '') <> '' or coalesce(bank_swift, '') <> ''
       or coalesce(bank_name, '') <> '' or coalesce(bank_branch, '') <> ''
    on conflict (customer_id) do nothing;
  end if;
end $$;

alter table public.customers
  drop column if exists bank_account_number,
  drop column if exists bank_account_holder_name,
  drop column if exists iban_number,
  drop column if exists bank_swift,
  drop column if exists bank_name,
  drop column if exists bank_branch;

-- ══════════════════════════════════════════════════════════════
-- Phase 3, third slice (5 Aug 2026) — department-scoped job_cards
-- access. Today any approved user can read/write ANY job card via the
-- API regardless of role — a Curtain Tracks Team login could read or
-- tamper with a pure-Joinery job that has zero curtain lines.
--
-- Restricts read/write to job_cards rows that actually have at least
-- one item routed to the caller's own department, but ONLY for the
-- department-scoped production roles (Joinery/Painting/Curtain/
-- Upholstery, via user_types.department). Commercial (Sales/Estimator/
-- Approver/Accounts), Operations (Operations Manager/Storekeeper/
-- Purchaser/Vehicle Fleet Inspector/Delivery-Scheduling/HR) and Owner
-- keep full, unrestricted access, unchanged — they legitimately need
-- cross-department visibility (routing, invoicing, budgeting,
-- oversight).
--
-- KNOWN RESIDUAL GAP, accepted deliberately (confirmed with Salman
-- before building): items is a single jsonb array column, not one row
-- per line — a mixed job (e.g. a TV Unit needing both Joinery and
-- Painting) is ONE job_cards row. This policy allows a department-
-- scoped role to write to that row at all once ANY of its items
-- belongs to them, but does not stop a raw API call from also
-- rewriting a DIFFERENT department's line data within that same items
-- array in the same update — no field-level diffing here, unlike the
-- quotation_pricing_lock trigger above. Lower severity than the
-- pricing-lock case (no direct financial gain, requires a deliberate
-- raw-API bypass of the app's own UI, which never does this) —
-- row-level scoping is the real, tractable win for this slice; full
-- field-level enforcement across 4 department keys is a bigger lift
-- left for later if it becomes a real concern.
--
-- INSERT policy is intentionally left unchanged (any approved user) —
-- job_cards rows are only ever created via confirmQuotationToJobCard()/
-- variation flows, triggered by Sales/Approver, never by a production
-- role's own UI.
-- ══════════════════════════════════════════════════════════════
create or replace function public.caller_job_department_key()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    -- Nav overhaul Phase 2 (5 Aug 2026) — admin gets the same full
    -- bypass owner already had here, checked directly by user_type
    -- rather than relying on department='admin' falling through the
    -- case below (which would happen to also return null today, but
    -- this makes the bypass explicit rather than incidental).
    when p.user_type in ('owner', 'admin') then null
    else case ut.department
      when 'joinery' then 'carp'
      when 'painting' then 'paint'
      when 'curtain' then 'curt'
      when 'upholstery' then 'uph'
      else null
    end
  end
  from public.profiles p
  join public.user_types ut on ut.key = p.user_type
  where p.id = auth.uid() and p.approval_status = 'approved';
$$;

drop policy if exists "job_cards readable by any signed-in user" on public.job_cards;
drop policy if exists "job_cards readable, department-scoped for production roles" on public.job_cards;
create policy "job_cards readable, department-scoped for production roles"
  on public.job_cards for select
  to authenticated
  using (
    public.is_approved() and (
      public.caller_job_department_key() is null
      or exists (
        select 1 from jsonb_array_elements(coalesce(items, '[]'::jsonb)) it
        where it->'departmentSequence' ? public.caller_job_department_key()
      )
    )
  );

drop policy if exists "job_cards updatable by any signed-in user" on public.job_cards;
drop policy if exists "job_cards updatable, department-scoped for production roles" on public.job_cards;
create policy "job_cards updatable, department-scoped for production roles"
  on public.job_cards for update
  to authenticated
  using (
    public.is_approved() and (
      public.caller_job_department_key() is null
      or exists (
        select 1 from jsonb_array_elements(coalesce(items, '[]'::jsonb)) it
        where it->'departmentSequence' ? public.caller_job_department_key()
      )
    )
  )
  with check (
    public.is_approved() and (
      public.caller_job_department_key() is null
      or exists (
        select 1 from jsonb_array_elements(coalesce(items, '[]'::jsonb)) it
        where it->'departmentSequence' ? public.caller_job_department_key()
      )
    )
  );

-- ────────────────────────────────────────────────────────────────────────
-- CURTAIN JOBS — Phase 2, final slice (6 Aug 2026).
-- Curtain's own production tracker (curtainJobs[] in data.js: window groups,
-- stitching/track/QC/install progress, BOM, item cards). Stored as one jsonb
-- payload per job rather than normalized tables — curtain.js treats the whole
-- job as one object it mutates in place across ~5,900 lines, and the client
-- syncs via a snapshot-diff autosave (see initCloudCurtainJobsCache /
-- autosaveCurtainJobs in data.js), so a whole-row upsert is the natural unit.
-- The derived flat `windows` array is stripped client-side before save and
-- rebuilt from windowGroups on hydrate.
-- RLS: any approved user (same baseline as customers/enquiries/quotations —
-- finer per-role scoping is Phase 3 territory, same note as those tables).
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.curtain_jobs (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.curtain_jobs enable row level security;

drop policy if exists "curtain_jobs readable by any signed-in user" on public.curtain_jobs;
create policy "curtain_jobs readable by any signed-in user"
  on public.curtain_jobs for select to authenticated using (public.is_approved());

drop policy if exists "curtain_jobs insertable by any signed-in user" on public.curtain_jobs;
create policy "curtain_jobs insertable by any signed-in user"
  on public.curtain_jobs for insert to authenticated with check (public.is_approved());

drop policy if exists "curtain_jobs updatable by any signed-in user" on public.curtain_jobs;
create policy "curtain_jobs updatable by any signed-in user"
  on public.curtain_jobs for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "curtain_jobs deletable by any signed-in user" on public.curtain_jobs;
create policy "curtain_jobs deletable by any signed-in user"
  on public.curtain_jobs for delete to authenticated using (public.is_approved());

-- Curtain's own purchase-inquiry tracker (purchaseInquiries[] in data.js) —
-- same whole-payload jsonb + snapshot-diff autosave pattern as curtain_jobs.
create table if not exists public.curtain_purchase_inquiries (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.curtain_purchase_inquiries enable row level security;

drop policy if exists "curtain_pi readable by any signed-in user" on public.curtain_purchase_inquiries;
create policy "curtain_pi readable by any signed-in user"
  on public.curtain_purchase_inquiries for select to authenticated using (public.is_approved());

drop policy if exists "curtain_pi insertable by any signed-in user" on public.curtain_purchase_inquiries;
create policy "curtain_pi insertable by any signed-in user"
  on public.curtain_purchase_inquiries for insert to authenticated with check (public.is_approved());

drop policy if exists "curtain_pi updatable by any signed-in user" on public.curtain_purchase_inquiries;
create policy "curtain_pi updatable by any signed-in user"
  on public.curtain_purchase_inquiries for update to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "curtain_pi deletable by any signed-in user" on public.curtain_purchase_inquiries;
create policy "curtain_pi deletable by any signed-in user"
  on public.curtain_purchase_inquiries for delete to authenticated using (public.is_approved());

-- Realtime for both curtain tables (idempotent, same pattern as the rest)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'curtain_jobs'
  ) then
    alter publication supabase_realtime add table public.curtain_jobs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'curtain_purchase_inquiries'
  ) then
    alter publication supabase_realtime add table public.curtain_purchase_inquiries;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- STAGE 1 (6 Aug 2026, merged roadmap) — the financial record + tasks +
-- activity log join the generic json-collection sync (see
-- CLOUD_JSON_COLLECTIONS in data.js): one (id, payload jsonb, updated_at)
-- row per record, snapshot-diff autosave, realtime. Same baseline RLS as
-- the other business tables (any approved user; finer per-role scoping is
-- the roadmap's Stage 8). Idempotent like the rest of this file.
-- ────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tax_invoices','sales_receipts','sales_credit_notes','suppliers',
    'purchase_requests','purchase_orders','purchase_invoices',
    'supplier_payments','debit_notes','app_tasks','activity_log',
    'labour_day_logs','bom_templates','payroll_runs','app_events','material_requests',
    'task_lists'
  ]
  loop
    execute format('create table if not exists public.%I (id text primary key, payload jsonb not null default ''{}''::jsonb, updated_at timestamptz not null default now())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s readable by approved users" on public.%I', t, t);
    execute format('create policy "%s readable by approved users" on public.%I for select to authenticated using (public.is_approved())', t, t);
    execute format('drop policy if exists "%s insertable by approved users" on public.%I', t, t);
    execute format('create policy "%s insertable by approved users" on public.%I for insert to authenticated with check (public.is_approved())', t, t);
    execute format('drop policy if exists "%s updatable by approved users" on public.%I', t, t);
    execute format('create policy "%s updatable by approved users" on public.%I for update to authenticated using (public.is_approved()) with check (public.is_approved())', t, t);
    execute format('drop policy if exists "%s deletable by approved users" on public.%I', t, t);
    execute format('create policy "%s deletable by approved users" on public.%I for delete to authenticated using (public.is_approved())', t, t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────
-- STAGE 8 (merged roadmap, 6 Aug 2026) — RLS matrix, next slice:
-- PRODUCTION roles (the ones caller_job_department_key() maps — joinery/
-- painting/curtain/upholstery floor+manager roles) become READ-ONLY on
-- quotations and customers. They never create or edit either in any real
-- flow; commercial/operations/owner/admin roles (dept key null) keep full
-- write. Same helper and philosophy as the job_cards department scoping.
-- NOTE: the roadmap's "re-add nodeAccessible() inside each open*Module()"
-- client gate was deliberately NOT built as specced: legitimate cross-
-- module hops exist for every role (Sales -> Purchasing Request Purchase,
-- Notify Storekeeper, jobsNewVariation, ownerGoTo), and a naive per-module
-- gate breaks them all. The server-side RLS here is the real boundary.
-- ────────────────────────────────────────────────────────────────────────
drop policy if exists "quotations insertable by any signed-in user" on public.quotations;
drop policy if exists "quotations insertable, commercial roles only" on public.quotations;
create policy "quotations insertable, commercial roles only"
  on public.quotations for insert to authenticated
  with check (public.is_approved() and public.caller_job_department_key() is null);

drop policy if exists "quotations updatable by any signed-in user" on public.quotations;
drop policy if exists "quotations updatable, commercial roles only" on public.quotations;
create policy "quotations updatable, commercial roles only"
  on public.quotations for update to authenticated
  using (public.is_approved() and public.caller_job_department_key() is null)
  with check (public.is_approved() and public.caller_job_department_key() is null);

drop policy if exists "customers insertable by any signed-in user" on public.customers;
drop policy if exists "customers insertable, commercial roles only" on public.customers;
create policy "customers insertable, commercial roles only"
  on public.customers for insert to authenticated
  with check (public.is_approved() and public.caller_job_department_key() is null);

drop policy if exists "customers updatable by any signed-in user" on public.customers;
drop policy if exists "customers updatable, commercial roles only" on public.customers;
create policy "customers updatable, commercial roles only"
  on public.customers for update to authenticated
  using (public.is_approved() and public.caller_job_department_key() is null)
  with check (public.is_approved() and public.caller_job_department_key() is null);

-- ────────────────────────────────────────────────────────────────────────
-- STAGE 6 (rest) — item photos. Salman's call: SALES uploads them at
-- quote level. Public-read bucket (product photos, embedded in print
-- documents via public URLs); uploads restricted to approved users.
-- ────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "item images publicly readable" on storage.objects;
create policy "item images publicly readable"
  on storage.objects for select using (bucket_id = 'item-images');

drop policy if exists "approved users upload item images" on storage.objects;
create policy "approved users upload item images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and public.is_approved());

drop policy if exists "approved users replace item images" on storage.objects;
create policy "approved users replace item images"
  on storage.objects for update to authenticated
  using (bucket_id = 'item-images' and public.is_approved())
  with check (bucket_id = 'item-images' and public.is_approved());


-- ═══ 17a Purchase (16 Aug 2026) — see supabase/17a-purchase.sql ═══
-- ═══════════════════════════════════════════════════════════════════════
-- 17a Purchase — tables, scoped RLS, the item master, and the
-- server-side duplicate gate. Idempotent: safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════════════

-- ── who counts as "the purchase side" ──────────────────────────────────
-- Salman's call: Purchase, Operations, Accounts, Owner. `storekeeper` is
-- included deliberately — the store is who physically books goods in
-- ("the store books the goods in", the handoff's own words), so excluding
-- them would break the GRN workflow outright, and they already see item
-- cost throughout Storekeeper's own screens.
create or replace function public.is_purchase_side()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval_status = 'approved'
      and p.user_type in ('purchaser','storekeeper','operations_manager','accounts','owner','admin')
  );
$$;

-- ── the four json collections ──────────────────────────────────────────
-- Same whole-object payload shape as the nineteen collections already
-- registered, so the existing snapshot-diff scanner handles them with no
-- new persistence code.
do $$
declare t text;
begin
  foreach t in array array['rfqs','goods_receipts','rate_contracts','purchase_documents'] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      payload jsonb not null default ''{}''::jsonb,
      updated_at timestamptz not null default now()
    )', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s readable by the purchase side" on public.%I', t, t);
    execute format('create policy "%s readable by the purchase side" on public.%I
      for select to authenticated using (public.is_purchase_side())', t, t);

    execute format('drop policy if exists "%s insertable by the purchase side" on public.%I', t, t);
    execute format('create policy "%s insertable by the purchase side" on public.%I
      for insert to authenticated with check (public.is_purchase_side())', t, t);

    execute format('drop policy if exists "%s updatable by the purchase side" on public.%I', t, t);
    execute format('create policy "%s updatable by the purchase side" on public.%I
      for update to authenticated using (public.is_purchase_side()) with check (public.is_purchase_side())', t, t);

    execute format('drop policy if exists "%s deletable by the purchase side" on public.%I', t, t);
    execute format('create policy "%s deletable by the purchase side" on public.%I
      for delete to authenticated using (public.is_purchase_side())', t, t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── the item master ────────────────────────────────────────────────────
-- Columnar, not a jsonb payload: the duplicate trigger below has to scan
-- sibling rows to find matches, which a single blob makes impossible.
create table if not exists public.item_master (
  id text primary key,                 -- "IT003318", client-generated
  name text not null,
  stock_category text,
  vendor_id text,
  catelog_id text,
  vat_percent numeric default 10,
  roll_width numeric,
  packing text default '',
  unit text,
  cost numeric default 0,
  avg_cost numeric default 0,
  selling_price numeric default 0,
  reorder_level numeric default 0,
  description text default '',
  purchase_allowed boolean default true,
  sales_allowed boolean default true,
  raw_material boolean default false,
  opening_stock numeric default 0,
  closing_stock numeric default 0,
  last_purchase_rate numeric default 0,
  -- Set only when a NEAR match was consciously declared distinct. This is
  -- also the server's evidence that the override happened, so the trigger
  -- below reads it rather than trusting a flag the client could omit.
  distinct_from jsonb,
  -- True only for the one-time load of the real Q-Pro export, where
  -- variants (SPANNER 13"/14"/15") legitimately coexist. Mirrors the
  -- client's own explicit-id import exemption.
  legacy_import boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.item_master enable row level security;

-- Everyone approved READS it — the Estimator's BOM typeahead, Curtain,
-- the store count and Jobs' material issue all resolve against it.
-- Only the purchase side WRITES: "Purchase owns the item code."
drop policy if exists "item master readable by any approved user" on public.item_master;
create policy "item master readable by any approved user"
  on public.item_master for select to authenticated using (public.is_approved());
drop policy if exists "item master writable by the purchase side" on public.item_master;
create policy "item master writable by the purchase side"
  on public.item_master for insert to authenticated with check (public.is_purchase_side());
drop policy if exists "item master updatable by the purchase side" on public.item_master;
create policy "item master updatable by the purchase side"
  on public.item_master for update to authenticated using (public.is_purchase_side()) with check (public.is_purchase_side());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_master'
  ) then
    alter publication supabase_realtime add table public.item_master;
  end if;
end $$;

-- ── the duplicate gate, server side ────────────────────────────────────
-- The handoff: "the same normalisation and threshold must run on save. A
-- client-side gate is a courtesy, not a guarantee." These mirror inorm()
-- and iScore() in purchase-item-gate.js exactly.

create or replace function public.item_abbrev(tok text)
returns text language sql immutable as $$
  select case tok
    when 'vnr' then 'veneer' when 'ven' then 'veneer' when 'veneers' then 'veneer' when 'vener' then 'veneer'
    when 'plywood' then 'ply' when 'plw' then 'ply' when 'plys' then 'ply'
    when 'book' then 'bookmatch' when 'matched' then 'bookmatch' when 'bookmatched' then 'bookmatch'
    when 'sht' then 'sheet' when 'sheets' then 'sheet' when 'shts' then 'sheet'
    when 'ltr' then 'l' when 'litre' then 'l' when 'litres' then 'l' when 'liter' then 'l' when 'liters' then 'l'
    when 'mtr' then 'm' when 'meter' then 'm' when 'metre' then 'm' when 'meters' then 'm' when 'metres' then 'm'
    when 'pcs' then 'nos' when 'pc' then 'nos' when 'piece' then 'nos' when 'pieces' then 'nos' when 'no' then 'nos'
    when 'brd' then 'board' when 'bd' then 'board'
    when 'lam' then 'laminate' when 'laminated' then 'laminate'
    when 'blk' then 'block' when 'blockboard' then 'block'
    when 'adh' then 'adhesive' when 'glue' then 'adhesive'
    when 'ss' then 'steel' when 'stainless' then 'steel'
    when 'alu' then 'aluminium' when 'aluminum' then 'aluminium' when 'al' then 'aluminium'
    when 'scr' then 'screw' when 'screws' then 'screw'
    when 'hng' then 'hinge' when 'hinges' then 'hinge'
    when 'hdl' then 'handle' when 'handles' then 'handle'
    when 'fab' then 'fabric' when 'fabrics' then 'fabric'
    when 'cur' then 'curtain' when 'curtains' then 'curtain'
    when 'trk' then 'track' when 'tracks' then 'track'
    when 'spanners' then 'spanner'
    else tok end
$$;

-- Word tokens (kind='w') and numeric tokens (kind='n'), distinct+sorted.
create or replace function public.item_tokens(d text, kind text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct t order by t), '{}'::text[])
  from (
    select public.item_abbrev(btrim(x, '.')) as t
    from unnest(regexp_split_to_array(lower(coalesce(d, '')), '[^a-z0-9.]+')) as x
    where btrim(x, '.') <> ''
  ) s
  where (kind = 'n') = (t ~ '^[0-9]+(\.[0-9]+)?$');
$$;

create or replace function public.item_dup_score(a text, b text)
returns numeric language plpgsql immutable as $$
declare
  aw text[]; an_ text[]; bw text[]; bn text[];
  at_ text[]; bt text[]; shared int; sc numeric;
begin
  aw := public.item_tokens(a, 'w'); an_ := public.item_tokens(a, 'n');
  bw := public.item_tokens(b, 'w'); bn := public.item_tokens(b, 'n');
  at_ := aw || an_; bt := bw || bn;
  if coalesce(array_length(at_, 1), 0) = 0 or coalesce(array_length(bt, 1), 0) = 0 then
    return 0;
  end if;
  select count(*) into shared
  from (select unnest(at_) intersect select unnest(bt)) s;
  sc := (2.0 * shared) / (array_length(at_, 1) + array_length(bt, 1));

  if aw = bw and an_ = bn then return 1.0; end if;
  if aw = bw and an_ <> bn then
    sc := greatest(sc, 0.70);                       -- variant, not a duplicate
  elsif aw <> bw and an_ = bn and coalesce(array_length(an_, 1), 0) > 0 then
    sc := sc + 0.10;
  end if;
  return least(1.0, greatest(0, sc));
end $$;

create or replace function public.enforce_item_master_duplicate()
returns trigger language plpgsql as $$
declare best numeric := 0; best_id text; best_name text; s numeric; r record;
begin
  -- The legacy export legitimately contains variants; the client exempts
  -- its own explicit-id import path for exactly the same reason.
  if coalesce(new.legacy_import, false) then return new; end if;

  for r in select id, name from public.item_master where id <> new.id loop
    s := public.item_dup_score(new.name, r.name);
    if s > best then best := s; best_id := r.id; best_name := r.name; end if;
  end loop;

  if best >= 0.92 then
    raise exception 'Cannot create — duplicate. % (%) is this item.', best_id, best_name
      using errcode = 'check_violation';
  end if;
  if best >= 0.62 and new.distinct_from is null then
    raise exception 'Cannot create — too close to % (%). State how this item differs first.', best_id, best_name
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_item_master_duplicate on public.item_master;
create trigger trg_item_master_duplicate
  before insert on public.item_master
  for each row execute function public.enforce_item_master_duplicate();


-- ═══ 18a Store Keeper (19 Aug 2026) — see supabase/18a-store.sql ═══
-- ═══════════════════════════════════════════════════════════════════════
-- 18a Store Keeper — tables, scoped RLS, and the server-side issue gate.
-- Idempotent: safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════════════

-- ── who works the store ────────────────────────────────────────────────
-- Writes are the store's own job. Reads are deliberately wider: a
-- production manager needs to see what is on the shelf and what is short
-- before their job starts, and stock levels are not the sensitive class
-- supplier pricing is. Same split item_master got.
create or replace function public.is_store_side()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval_status = 'approved'
      and p.user_type in ('storekeeper','operations_manager','owner','admin')
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'store_locations','store_bins','stock_lots','stock_reservations',
    'store_issues','store_transfers','store_returns','tool_loans','stock_counts'
  ] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      payload jsonb not null default ''{}''::jsonb,
      updated_at timestamptz not null default now()
    )', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s readable by any approved user" on public.%I', t, t);
    execute format('create policy "%s readable by any approved user" on public.%I
      for select to authenticated using (public.is_approved())', t, t);

    execute format('drop policy if exists "%s insertable by the store side" on public.%I', t, t);
    execute format('create policy "%s insertable by the store side" on public.%I
      for insert to authenticated with check (public.is_store_side())', t, t);

    execute format('drop policy if exists "%s updatable by the store side" on public.%I', t, t);
    execute format('create policy "%s updatable by the store side" on public.%I
      for update to authenticated using (public.is_store_side()) with check (public.is_store_side())', t, t);

    execute format('drop policy if exists "%s deletable by the store side" on public.%I', t, t);
    execute format('create policy "%s deletable by the store side" on public.%I
      for delete to authenticated using (public.is_store_side())', t, t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── the hard gate, server side ─────────────────────────────────────────
-- 18a: "Material leaves the store against a job card and nothing else...
-- it must block, not warn... There is no override." And: "the same rule
-- must run on save. A client-side gate is a courtesy, not a guarantee. An
-- issue with no job card must be rejected by the API."
--
-- This mirrors issueMaterialToJob() in store-data.js. It refuses the same
-- three things: nothing, the words that mean "no job card", and a job id
-- that does not appear in job_cards.
create or replace function public.enforce_store_issue_job_card()
returns trigger language plpgsql as $$
declare jc text;
begin
  jc := btrim(coalesce(new.payload->>'jobCardId', ''));

  if jc = '' then
    raise exception 'No job card — nothing can be issued. Material only leaves this store against a job card.'
      using errcode = 'check_violation';
  end if;

  -- "General use is not a job card." Named because it is the request the
  -- store actually gets, and the one the gate exists to refuse.
  if lower(jc) in ('general', 'general use', 'none', 'n/a') then
    raise exception 'General use is not a job card. Consumables still belong to a job.'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.job_cards where id = jc) then
    raise exception 'Job card % does not exist — nothing can be issued against it.', jc
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_store_issue_job_card on public.store_issues;
create trigger trg_store_issue_job_card
  before insert or update on public.store_issues
  for each row execute function public.enforce_store_issue_job_card();

-- A hold belongs to a job card too — same rule, same reason. Without this
-- a hold could be parked against nothing and quietly freeze good stock.
create or replace function public.enforce_reservation_job_card()
returns trigger language plpgsql as $$
declare jc text;
begin
  jc := btrim(coalesce(new.payload->>'jobCardId', ''));
  if jc = '' then
    raise exception 'A hold belongs to a job card.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.job_cards where id = jc) then
    raise exception 'Job card % does not exist — stock cannot be held for it.', jc
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_reservation_job_card on public.stock_reservations;
create trigger trg_reservation_job_card
  before insert or update on public.stock_reservations
  for each row execute function public.enforce_reservation_job_card();


-- ═══════════════════════════════════════════════════════════════════════
-- 19a Production manager — tables, scoped RLS, and the two commitments
-- that are genuinely enforceable server-side.
-- Idempotent: safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════════════

-- ── who works production ───────────────────────────────────────────────
-- Writes belong to the people who actually allot work: the production
-- manager whose module this is, and operations, who routes jobs in and
-- approves the department budgets. Reads are deliberately wider (any
-- approved user): a crew lead, the store and the estimator all need to see
-- the board and the cutting lists, and none of this carries a selling
-- price. Same read/write split 18a's stock tables and item_master use.
--
-- Deliberately NOT included in writes: upholstery_manager and the painting
-- lead. Their lanes appear on the board, but the slots are allotted BY the
-- production manager — they read their work, they do not book it. Add them
-- here if that ever stops being true.
create or replace function public.is_production_side()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval_status = 'approved'
      and p.user_type in ('joinery_production_manager','operations_manager','owner','admin')
  );
$$;

do $$
declare t text;
begin
  -- production_input_requests, not input_requests: too generic a name to
  -- own in a shared schema. Same call as 18a's stock_reservations.
  foreach t in array array[
    'lane_slots','bom_revisions','cutting_sheets',
    'pressing_batches','overtime_shifts','production_input_requests',
    'crew_members'
  ] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      payload jsonb not null default ''{}''::jsonb,
      updated_at timestamptz not null default now()
    )', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s readable by any approved user" on public.%I', t, t);
    execute format('create policy "%s readable by any approved user" on public.%I
      for select to authenticated using (public.is_approved())', t, t);

    execute format('drop policy if exists "%s insertable by the production side" on public.%I', t, t);
    execute format('create policy "%s insertable by the production side" on public.%I
      for insert to authenticated with check (public.is_production_side())', t, t);

    execute format('drop policy if exists "%s updatable by the production side" on public.%I', t, t);
    execute format('create policy "%s updatable by the production side" on public.%I
      for update to authenticated using (public.is_production_side()) with check (public.is_production_side())', t, t);

    execute format('drop policy if exists "%s deletable by the production side" on public.%I', t, t);
    execute format('create policy "%s deletable by the production side" on public.%I
      for delete to authenticated using (public.is_production_side())', t, t);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── commitment 5, server side: overtime buys hours, not material ───────
-- "Every shift is booked against the target it recovers AND the cause of
-- the slip, so the pattern is visible: the same cause three weeks running
-- is a planning problem, not a labour cost." A shift with no stated cause
-- defeats that, so the enum is enforced here and not only in the client —
-- the handoff's own line about a client-side gate being a courtesy rather
-- than a guarantee applies just as much to this one.
create or replace function public.enforce_overtime_cause()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text;
begin
  c := new.payload ->> 'cause';
  if c is null or btrim(c) = '' then
    raise exception 'Overtime needs a stated cause — a shift with no cause hides the pattern that would fix it.';
  end if;
  if c not in ('BOM revision late','Material late','Client change') then
    raise exception 'Overtime cause must be one of the recorded causes, not free text. Got: %', c;
  end if;
  if (new.payload ->> 'recoversTarget') is null then
    raise exception 'Overtime must be booked against the target it recovers.';
  end if;
  return new;
end;
$$;
drop trigger if exists overtime_cause_gate on public.overtime_shifts;
create trigger overtime_cause_gate
  before insert or update on public.overtime_shifts
  for each row execute function public.enforce_overtime_cause();

-- ── commitment 3, server side: hours and quantities, never a price ─────
-- "He returns hours and quantities, never a price. The estimator turns
-- that into money." The handoff is explicit that selling price, margin and
-- rates are to be filtered SERVER-side rather than trusted to the client,
-- so an answer carrying anything money-shaped is refused here too.
create or replace function public.enforce_no_price_in_answer()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if new.payload ? 'answer' and jsonb_typeof(new.payload -> 'answer') = 'object' then
    for k in select jsonb_object_keys(new.payload -> 'answer') loop
      if lower(k) ~ '(rate|price|cost|amount|margin|total|bd|money|value)' then
        raise exception 'Production returns hours and quantities, not money. Remove "%" — the estimator prices it.', k;
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists no_price_in_answer_gate on public.production_input_requests;
create trigger no_price_in_answer_gate
  before insert or update on public.production_input_requests
  for each row execute function public.enforce_no_price_in_answer();

-- ── NOT enforced server-side, and why ──────────────────────────────────
-- Commitment 1 (no lane slot without material and a live BOM) and
-- commitment 4 (a BOM change kills the cutting list) both need to read
-- across job cards, quotations and stock. In this schema those live as
-- whole-object jsonb payloads, not relational rows, so a trigger would
-- have to parse three blobs and would break the first time any of their
-- shapes changed. They stay enforced in production-data.js, where they are
-- covered by e2e-production-19a.js. Stated here rather than left as a
-- silent gap: if these ever need real server-side teeth, the job card and
-- its BOM have to be modelled relationally first.


-- ═══════════════════════════════════════════════════════════════════════
-- 20a Upholstery supervisor — tables and scoped RLS.
-- Idempotent: safe to run repeatedly.
-- ═══════════════════════════════════════════════════════════════════════

-- ── who works upholstery ───────────────────────────────────────────────
-- Writes belong to the people who run the five stages: the upholstery
-- manager (the supervisor whose module this is) and the team leader who
-- books stages under him, plus operations, owner and admin. QC/Packaging
-- reads. Reads are wider on purpose (any approved user): the estimator,
-- the store and production all need to see the board, the register and
-- the tickets, and none of it carries a selling price. Same read/write
-- split 19a's production tables use.
create or replace function public.is_upholstery_side()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval_status = 'approved'
      and p.user_type in ('upholstery_manager','upholstery_team_leader','operations_manager','owner','admin')
  );
$$;

do $$
declare t text;
begin
  -- uph_stage_slots / uph_overtime / uph_stage_members, not stage_slots /
  -- overtime / members: too generic a name to own in a shared schema.
  -- fabric_rolls IS the record — a roll with a dye lot, per the handoff.
  foreach t in array array[
    'uph_stage_slots','uph_overtime','uph_specs','fabric_rolls','fabric_holds',
    'fabric_plans','foam_schedules','com_notes','uph_stage_members'
  ] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      payload jsonb not null default ''{}''::jsonb,
      updated_at timestamptz not null default now()
    )', t);
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s readable by any approved user" on public.%I', t, t);
    execute format('create policy "%s readable by any approved user" on public.%I
      for select to authenticated using (public.is_approved())', t, t);

    execute format('drop policy if exists "%s insertable by the upholstery side" on public.%I', t, t);
    execute format('create policy "%s insertable by the upholstery side" on public.%I
      for insert to authenticated with check (public.is_upholstery_side())', t, t);

    execute format('drop policy if exists "%s updatable by the upholstery side" on public.%I', t, t);
    execute format('create policy "%s updatable by the upholstery side" on public.%I
      for update to authenticated using (public.is_upholstery_side()) with check (public.is_upholstery_side())', t, t);

    execute format('drop policy if exists "%s deletable by the upholstery side" on public.%I', t, t);
    execute format('create policy "%s deletable by the upholstery side" on public.%I
      for delete to authenticated using (public.is_upholstery_side())', t, t);

    -- realtime, so a second device sees the board move
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── input requests are shared with production ──────────────────────────
-- A pricing request asked of upholstery lives in production_input_requests
-- with dept = 'uph' (one table, one reader per shop). The upholstery side
-- has to be able to ANSWER its own, so the write policies widen to either
-- shop. The commitment-3 trigger on that table (no money-shaped key in an
-- answer) already applies to both.
drop policy if exists "production_input_requests insertable by the production side" on public.production_input_requests;
create policy "production_input_requests insertable by the production side" on public.production_input_requests
  for insert to authenticated with check (public.is_production_side() or public.is_upholstery_side());
drop policy if exists "production_input_requests updatable by the production side" on public.production_input_requests;
create policy "production_input_requests updatable by the production side" on public.production_input_requests
  for update to authenticated using (public.is_production_side() or public.is_upholstery_side())
  with check (public.is_production_side() or public.is_upholstery_side());

-- ── commitment 3, server-side: a COM note is signed by the client AND
--    countersigned by sales before it counts. The client can mark it
--    signed; the database refuses a payload that claims sales signed with
--    no name behind it.
create or replace function public.enforce_com_note_signatures()
returns trigger language plpgsql as $$
begin
  if (new.payload ? 'salesSignedBy') and (new.payload->>'salesSignedBy') is not null
     and coalesce(new.payload->>'clientSignedBy', '') = '' then
    raise exception 'A COM note cannot be countersigned by sales before the client has signed it.';
  end if;
  return new;
end $$;
drop trigger if exists com_notes_signatures on public.com_notes;
create trigger com_notes_signatures before insert or update on public.com_notes
  for each row execute function public.enforce_com_note_signatures();


-- ═══════════════════════════════════════════════════════════════════════
-- The crew clock (2 Sep 2026) — sessions, crews made in the timer,
-- progress photos, and the photo bucket. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ── who holds the clock ────────────────────────────────────────────────
-- Anyone who leads work on a floor or a site: the new Installation Crew
-- Lead, the production and upholstery managers and their team leaders, the
-- painting lead, Curtain's manager, team leader and site installer, plus
-- operations, owner and admin. Any approved user reads — the photos are
-- what Sales and the Owner look at, and a session carries hours, never a
-- rate.
create or replace function public.is_floor_side()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval_status = 'approved'
      and p.user_type in (
        'installation_crew_lead',
        'joinery_production_manager','joinery_assistant_production_manager','joinery_team_leader',
        'joinery_floor_supervisor','joinery_site_supervisor',
        'upholstery_manager','upholstery_team_leader',
        'painting_lead',
        'curtain_manager','curtain_team_leader','curtain_site_installer','curtain_tracks_team',
        'operations_manager','owner','admin')
  );
$$;

insert into public.user_types (key, label, dashboard_node_id, department) values
  ('installation_crew_lead', 'Installation Crew Lead', 'crew-timer', 'operations')
on conflict (key) do update set label = excluded.label, dashboard_node_id = excluded.dashboard_node_id, department = excluded.department;

do $$
declare t text;
begin
  foreach t in array array['crew_sessions','timer_crews','progress_photos'] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      payload jsonb not null default ''{}''::jsonb,
      updated_at timestamptz not null default now()
    )', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s readable by any approved user" on public.%I', t, t);
    execute format('create policy "%s readable by any approved user" on public.%I
      for select to authenticated using (public.is_approved())', t, t);
    execute format('drop policy if exists "%s insertable by the floor side" on public.%I', t, t);
    execute format('create policy "%s insertable by the floor side" on public.%I
      for insert to authenticated with check (public.is_floor_side())', t, t);
    execute format('drop policy if exists "%s updatable by the floor side" on public.%I', t, t);
    execute format('create policy "%s updatable by the floor side" on public.%I
      for update to authenticated using (public.is_floor_side()) with check (public.is_floor_side())', t, t);
    execute format('drop policy if exists "%s deletable by the floor side" on public.%I', t, t);
    execute format('create policy "%s deletable by the floor side" on public.%I
      for delete to authenticated using (public.is_floor_side())', t, t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- The day-logs the clock writes at End are the existing labour_day_logs
-- table; its policies already cover any approved user. The clock adds no
-- new ledger.

-- ── progress photos: a public-read bucket, the same shape as item-images ─
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "progress photos publicly readable" on storage.objects;
create policy "progress photos publicly readable"
  on storage.objects for select using (bucket_id = 'progress-photos');

drop policy if exists "floor side uploads progress photos" on storage.objects;
create policy "floor side uploads progress photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and public.is_floor_side());


-- ═══════════════════════════════════════════════════════════════════════
-- Fixes from the end-to-end run, iteration 1 (3 Sep 2026). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Finding: an Estimator could not raise a pricing request live ────────
-- production_input_requests' write policies named only the production and
-- upholstery sides, so the ESTIMATOR's insert (pricing_input), SALES'
-- (fabric_change) and OPERATIONS' (bom_budget_input, which happened to be
-- covered) were refused at the database — the request existed in that one
-- browser and nowhere else. Who may RAISE a request is the raiserRole
-- check in raiseInputRequest(); the table now lets any approved user insert
-- and update, and the commitment-3 trigger (no money-shaped key in an
-- answer) keeps applying to everyone.
drop policy if exists "production_input_requests insertable by the production side" on public.production_input_requests;
create policy "production_input_requests insertable by the production side" on public.production_input_requests
  for insert to authenticated with check (public.is_approved());
drop policy if exists "production_input_requests updatable by the production side" on public.production_input_requests;
create policy "production_input_requests updatable by the production side" on public.production_input_requests
  for update to authenticated using (public.is_approved()) with check (public.is_approved());

-- ── Finding: the standing upholstery specs vanished in a live session ───
-- upholstery-data.js seeds eight standing specs at load; initCloudJson
-- Collections() then hydrates uph_specs and REPLACES the array with the
-- table's contents — which was empty. The eight rows were inserted once
-- with the Management API on 3 Sep 2026 (payload = the seed objects), and
-- seedUphSpecs() now also re-seeds after hydration when the table comes
-- back empty. Nothing to run here; recorded so a fresh project knows.

-- ── F14 (end-to-end run, 5 Sep 2026): the four job-card fields Operations
-- sets that never had a column — urgent, promised date, target date, notes.
-- Idempotent.
alter table public.job_cards add column if not exists urgent boolean not null default false;
alter table public.job_cards add column if not exists promised_date date;
alter table public.job_cards add column if not exists target_date date;
alter table public.job_cards add column if not exists notes text not null default '';

-- ── F16 (end-to-end run, 5 Sep 2026): a lane slot CLAIMS its boards
-- (allotLaneSlot -> reserveJobMaterial -> reserveStockForJob, 26 Aug), and
-- the person allotting it is the production manager — who was not on the
-- store side, so every one of those reservations was refused with a 403
-- and existed only in that session. The production side may now write
-- reservations; issues, transfers and counts stay the store's own.
drop policy if exists "stock_reservations insertable by the store side" on public.stock_reservations;
create policy "stock_reservations insertable by the store side"
  on public.stock_reservations for insert to authenticated with check (public.is_store_side() or public.is_production_side());
drop policy if exists "stock_reservations updatable by the store side" on public.stock_reservations;
create policy "stock_reservations updatable by the store side"
  on public.stock_reservations for update to authenticated using (public.is_store_side() or public.is_production_side()) with check (public.is_store_side() or public.is_production_side());
drop policy if exists "stock_reservations deletable by the store side" on public.stock_reservations;
create policy "stock_reservations deletable by the store side"
  on public.stock_reservations for delete to authenticated using (public.is_store_side() or public.is_production_side());

-- ── Discount tiers (Salman, 5 Sep 2026 — end-to-end run finding F9) ──
-- Sales may discount a quotation up to 10%, the Estimator up to 20%, the
-- Owner up to 30%; Admin sets a different ceiling per role or per person
-- from the masters page. The client refuses in setQuoteDiscount(); this
-- trigger refuses the raw API the same way, because a screen-only ceiling
-- is exactly what the run walked past.
-- Idempotent.

create table if not exists public.discount_limits (
  id text primary key,                    -- 'role:<user_type>' or 'user:<display_name>'
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.discount_limits enable row level security;
drop policy if exists "discount_limits readable by any approved user" on public.discount_limits;
create policy "discount_limits readable by any approved user"
  on public.discount_limits for select to authenticated using (public.is_approved());
drop policy if exists "discount_limits insertable by owner or admin" on public.discount_limits;
create policy "discount_limits insertable by owner or admin"
  on public.discount_limits for insert to authenticated
  with check (public.is_approved() and (select user_type from public.profiles where id = auth.uid()) in ('owner', 'admin'));
drop policy if exists "discount_limits updatable by owner or admin" on public.discount_limits;
create policy "discount_limits updatable by owner or admin"
  on public.discount_limits for update to authenticated
  using ((select user_type from public.profiles where id = auth.uid()) in ('owner', 'admin'))
  with check ((select user_type from public.profiles where id = auth.uid()) in ('owner', 'admin'));
drop policy if exists "discount_limits deletable by owner or admin" on public.discount_limits;
create policy "discount_limits deletable by owner or admin"
  on public.discount_limits for delete to authenticated
  using ((select user_type from public.profiles where id = auth.uid()) in ('owner', 'admin'));
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'discount_limits') then
    alter publication supabase_realtime add table public.discount_limits;
  end if;
end $$;

-- The caller's ceiling: a per-person row wins, then the role row, then the
-- defaults. A call with no auth.uid() (SQL editor, service role) is not
-- limited — that is the administrator, not a role.
create or replace function public.caller_discount_limit() returns numeric
language plpgsql security definer set search_path = public as $$
declare p record; v numeric;
begin
  if auth.uid() is null then return 100; end if;
  select display_name, user_type into p from public.profiles where id = auth.uid();
  if p is null then return 0; end if;
  select (payload->>'maxPct')::numeric into v from public.discount_limits where id = 'user:' || p.display_name;
  if v is not null then return v; end if;
  select (payload->>'maxPct')::numeric into v from public.discount_limits where id = 'role:' || p.user_type;
  if v is not null then return v; end if;
  return case p.user_type when 'sales' then 10 when 'estimator' then 20 when 'owner' then 30 when 'admin' then 30 else 0 end;
end $$;

-- Refuse any line whose discount RISES past the caller's ceiling. A line
-- already carrying a higher discount (applied by a higher tier) may be
-- edited for anything else — only an increase is judged.
create or replace function public.enforce_quotation_discount_limit() returns trigger
language plpgsql as $$
declare lim numeric; it jsonb; old_it jsonb; newpct numeric; oldpct numeric;
begin
  lim := public.caller_discount_limit();
  for it in select value from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
    newpct := coalesce(nullif(it->>'discPercent', '')::numeric, 0);
    oldpct := 0;
    if tg_op = 'UPDATE' then
      select value into old_it from jsonb_array_elements(coalesce(old.items, '[]'::jsonb)) where value->>'lineId' = it->>'lineId' limit 1;
      if old_it is not null then oldpct := coalesce(nullif(old_it->>'discPercent', '')::numeric, 0); end if;
    end if;
    if newpct > oldpct + 0.01 and newpct > lim + 0.01 then
      raise exception 'A % discount is above your limit of % — it needs a higher tier.', round(newpct, 1), lim using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists quotation_discount_limit on public.quotations;
create trigger quotation_discount_limit
  before insert or update on public.quotations
  for each row execute function public.enforce_quotation_discount_limit();
