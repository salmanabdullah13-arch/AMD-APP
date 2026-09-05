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
