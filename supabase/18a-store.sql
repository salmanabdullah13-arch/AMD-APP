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
