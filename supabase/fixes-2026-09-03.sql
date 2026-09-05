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
