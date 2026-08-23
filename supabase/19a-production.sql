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
