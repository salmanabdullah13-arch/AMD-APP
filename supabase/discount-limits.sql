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
