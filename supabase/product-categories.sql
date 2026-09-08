-- ── Product categories (Salman, 8 Sep 2026) ──────────────────────────────
-- "I'm unable to ascertain which division of my company is driving the
-- revenue." Curtains apart from roman blinds apart from roller blinds; TV
-- units apart from wardrobes apart from vanities. `product` on a quotation
-- line is free text, so nothing grouped one against another — this is the
-- master that does.
--
-- Read by anyone approved: the Sales wizard, the Estimator and the Owner's
-- product P&L all need it. Written by the roles that own a master — Sales
-- adds a category when a genuinely new product comes up, Owner and Admin
-- maintain the list.
-- Idempotent.

create table if not exists public.product_categories (
  id text primary key,                    -- 'PC001'
  payload jsonb not null default '{}'::jsonb,   -- { name, division, status }
  updated_at timestamptz not null default now()
);
alter table public.product_categories enable row level security;

drop policy if exists "product_categories readable by any approved user" on public.product_categories;
create policy "product_categories readable by any approved user"
  on public.product_categories for select to authenticated using (public.is_approved());

drop policy if exists "product_categories writable by sales side" on public.product_categories;
create policy "product_categories writable by sales side"
  on public.product_categories for insert to authenticated
  with check (public.is_approved() and (select user_type from public.profiles where id = auth.uid())
    in ('sales', 'estimator', 'accounts', 'operations_manager', 'owner', 'admin'));

drop policy if exists "product_categories updatable by sales side" on public.product_categories;
create policy "product_categories updatable by sales side"
  on public.product_categories for update to authenticated
  using ((select user_type from public.profiles where id = auth.uid())
    in ('sales', 'estimator', 'accounts', 'operations_manager', 'owner', 'admin'))
  with check ((select user_type from public.profiles where id = auth.uid())
    in ('sales', 'estimator', 'accounts', 'operations_manager', 'owner', 'admin'));

drop policy if exists "product_categories deletable by owner or admin" on public.product_categories;
create policy "product_categories deletable by owner or admin"
  on public.product_categories for delete to authenticated
  using ((select user_type from public.profiles where id = auth.uid()) in ('owner', 'admin'));

do $$ begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_categories')
  then alter publication supabase_realtime add table public.product_categories; end if;
end $$;
