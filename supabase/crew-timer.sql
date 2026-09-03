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
