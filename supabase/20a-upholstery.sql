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
