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
