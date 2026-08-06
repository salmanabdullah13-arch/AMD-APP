# AMD-APP End-to-End Systems Audit — 6 Aug 2026 (Fable, in-session live-probed)

**Method.** Three production workflows walked start-to-finish against the real
`data.js` functions via a temporary Playwright probe (offline `file://`, nothing
persisted, probe deleted after). Every finding below was reproduced live with
real values, not inferred from reading code. Zero uncaught page errors during the run.

This audit re-confirms and supersedes the written-only 6 Aug entry already in
CLAUDE.md — same findings, now each demonstrated with numbers. **Nothing here is
built yet** except where a fix commit is explicitly noted; the fix plan at the end
is scoped for Salman's go-ahead phase by phase.

---

## 1. Three flow walkthroughs

### Workflow 1 — Joinery + Painting (a painted TV-unit cabinet)

Walked: enquiry → quotation (BOM-priced, real cost-plus) → full Sales→Estimator→
Approver→Open cycle → Job Card `JB26AMD01000` (amount **BD 1801.80**) → Operations
routing → carp budget → sub-stage walk → QC → hand-off to Painting → paint QC →
done → invoice.

**Held up (verified live):**
- Painted-cabinet auto-routes `["carp","paint"]` correctly.
- Fresh job appears in the Operations routing queue immediately.
- Budget gate **blocks** `startLineProduction()` until the department budget is approved.
- **BD 5,000 threshold + maker-checker both work**: a BD 5,600 budget — self-approval by the submitter is *blocked*; after the Operations Manager approves it lands in `pending-owner-review` (not `approved`); production stays blocked; only after `approveDepartmentBudgetOwnerReview()` does it reach `approved` and unblock. (Phase 2 fix confirmed solid live.)
- Joinery sub-stage gate **blocks** Submit-for-QC at `drafting`, allows it at `assembly`.
- Hand-off puts the paint line into `getPaintingQueue()` instantly; paint walks to `done`.

**Breaks found:**
- **W1-03 (Critical) — double Job Card from one quotation.** Re-approving an already-*confirmed* quotation is allowed (reverts it to `open`), and confirming again produced a **second** job card `JB26AMD01001` for the same quote. Two live jobs, one quotation, double revenue/production.
- **W1-05 (Critical) — approve a Sales-stage draft directly.** `approveQuotation()` on a brand-new draft with no BOM and no Estimator/Approver transfer is *allowed* — the entire estimation/approval cycle is skippable in one call. `lifecycleStatus` is **not** covered by the server-side pricing-lock trigger, so a Sales session could do this over the raw API.
- **W1-15 (High) — unlimited invoicing.** Two full 100%-value invoices (`IN26AMD01000`, `IN26AMD01001`) generated on the same job with no cumulative cap.
- **W1-11 (Medium) — QC self-pass.** `recordLineQCResult()` accepts any name, including the same identity that produced the work — no maker-checker on QC anywhere.
- **W1-13 (Medium) — no hand-off notification.** Nothing messages the Painting Lead when a line hands off; the Messages system exists but the pipeline never calls it. (0 messages after hand-off.)

### Workflow 2 — Joinery (sofa frame) + Upholstery

Walked: sofa quote → manual `["carp","uph"]` override → carp frame through QC →
hand-off → uph budget → uph production → QC fail → rework → QC pass → hand-off →
done; then a mid-flow Variation (matching ottoman) merged back in.

**Held up:**
- Carp→uph hand-off: uph queue is empty before hand-off, populated after, uph status `queued`. Frame-done correctly does *not* mark the job done.
- Variation mid-flow merges correctly: job.amount **BD 2282.28 → 2417.42**, uph budget slot survives (Phase 1 fix confirmed).

**Breaks found:**
- **W2-01 (Medium) — sofa never suggests carp.** `suggestDepartmentSequence('Custom Sofa Set')` returns `["uph"]` only. A sofa that needs a built frame depends entirely on an Estimator manually adding carp — nothing suggests it.
- **W2-03a (Medium) — no QC reject reason.** A shared-pipeline QC fail stores `{status:"rework", rejectReason:null}`. Curtain's own QC captures reasons; the shared Joinery/Upholstery/Painting pipeline never adopted the field, so reject-reason trends are impossible for those roles.
- **W2-04 (Medium) — multi-dept revenue attribution.** The **BD 2282.28** sofa job is attributed wholly to the enquiry's single `division` ("Furniture") in `getMonthlyRevenueByDivision()`. Carp built the frame, uph did the covering — there's no per-department split, so division revenue is wrong for any multi-department job.
- **W2-06 (Medium) — `refreshJobFromQuotation()` doesn't recompute amount.** After correcting the quote's rate +100 and refreshing, `job.amount` stayed **2417.42 → 2417.42**. The revenue figure goes stale against the corrected quotation.
- Variation value buckets into the job's **original** month (`job.date`) in the revenue chart, not the month the variation actually landed.

### Workflow 3 — Curtains / Blinds / Track

Walked: curtain quote → confirm → bridge into `curtainJobs[]` → routing → delivery
+ feedback; plus a track-making probe.

**Held up:**
- Curtain job bridges into `curtainJobs[]` correctly (Phase 2-audit fix #1 holds).
- The `curt` `departmentStatuses`/budget entry that routing writes is inert-but-harmless — Curtain works its own `curtainJobs[]` tracker, and Curtain has its own separate `budgetStatus` flow (no `DEPARTMENT_APPROVERS.curt`).

**Breaks found:**
- **W3-01 / W3-02 (Critical) — Metal Works dead end.** `"Motorized Track"` routes to `metal`. Live: the job routes, gets a `metal` budget slot, but `DEPARTMENT_APPROVERS.metal` is **undefined** — no approver, no module, no budget-submission screen. `startLineProduction()` is permanently blocked ("budget must be approved") and `getJobAttentionFlags()` returns `[]` — the stuck job is **invisible to every queue and flag**. Metal exists in `SALES_DIVISIONS`/`DEPTS`/keywords but nowhere else.

### Deliver / schedule (cross-workflow)

- **DL-01 (High) — deliver before production.** On a routed job with carp still `queued` (nothing started), a full-qty delivery note was **allowed**; `deliveredQty` went to full, and `getPipelineFunnel()` flipped the job from **In Production → Delivered** (count 1, BD 2702.70). The funnel now reports a job "Delivered" that hasn't been built.
- **DL-02 (High) — schedule mark-delivered unchecked.** `markDeliveryScheduleStatus(id,'delivered')` succeeds with no check against actual `deliveredQty`.

### Cross-cutting

- **X-01 (Medium) — no urgent/priority/promised-date field** anywhere on `jobCards`.
- **X-02 (Medium) — `setJobStatus` ungated.** Any name can set a job `completed` while departments are mid-flight.

---

## 2. Consolidated loophole list (ranked by business risk)

| # | Risk | Loophole | Evidence |
|---|------|----------|----------|
| 1 | **Money — double billing/production** | Re-approve confirmed quote → second Job Card | W1-03: `JB26AMD01000` + `JB26AMD01001` from one quote |
| 2 | **Money/integrity — skip estimation** | Approve a Sales draft directly, no BOM/cycle; not covered by pricing-lock RLS | W1-05 |
| 3 | **Money — over-invoicing** | No cumulative cap; two 100% invoices | W1-15: `IN26AMD01000`+`01001` |
| 4 | **Delivery date/integrity — stuck forever** | Metal-routed job un-actionable, invisible to flags | W3-02: no approver, no module |
| 5 | **Delivery integrity — false "delivered"** | Deliver full qty before production; funnel lies | DL-01: In Production→Delivered with carp `queued` |
| 6 | **QC integrity** | QC pass recordable by the producer; no reject reason | W1-11, W2-03a |
| 7 | **Reporting — wrong revenue** | Multi-dept job attributed to one division; refresh doesn't recompute; variation months misbucket | W2-04, W2-06 |
| 8 | **Process** | `setJobStatus` ungated; no urgent flag; no hand-off notifications | X-02, X-01, W1-13 |

---

## 3. Dashboard / analytics gaps per role

The Dashboard Analytics rollout's premise holds — every oversight dashboard now
has real charts, and shop-floor roles staying bare is still correct after walking
one through mid-job. Gaps that are cheap and real:

- **`getMonthlyRevenueByDivision` is single-division per job** — wrong for every multi-department job (the sofa case). Needs per-item department attribution to be trustworthy (loophole #7).
- **Pipeline funnel counts "Delivered" off delivery notes, not production completion** — so the funnel inherits loophole #5. Fixing the delivery gate fixes the funnel too.
- **Per-salesperson scope params already exist** in all three aggregations (`getMonthlyRevenueByDivision(n, {salesPerson})` etc.) but are never surfaced on the Sales dashboard — a free win.
- **Storekeeper** has `getJobMaterialRequirement()` (reorder data) but no reorder tile on the dashboard — the report exists, the signal doesn't.
- **Estimator / Approver** dashboards show category counts; they'd be more useful with quote **aging** (how long a quote's been sitting in each stage).
- **QC roles** should get reject-reason trends — but only *after* reject reasons are captured (loophole #6).

---

## 4. Phased fix plan (each phase = one commit + e2e test)

- **Phase A — quotation lifecycle gates + double-billing** *(criticals #1, #2, #3)*
  Gate `approveQuotation()` (must be `approver` stage, not already confirmed);
  gate `confirmQuotationToJobCard()` against a quote that already has a job;
  cumulative invoice cap in `generateInvoiceFromJob()`. Recompute `job.amount`
  in `refreshJobFromQuotation()`.
- **Phase B — routing dead-ends + delivery integrity** *(criticals #4, highs #5)*
  Drop `metal` from `suggestDepartmentSequence()` and the Estimator checkboxes;
  route track/rail keywords to `curt`. Block full-qty delivery + `markDeliveryScheduleStatus('delivered')` until the job's routed departments are `done`.
- **Phase C — QC integrity** *(loophole #6)*
  Capture a reject reason on shared-pipeline QC fails (adopt Curtain's pattern);
  decide + apply maker-checker on QC pass.
- **Phase D — revenue attribution** *(loophole #7)*
  Per-item department revenue split; bucket variation value into the month it lands.
- **Phase E — process polish** *(loophole #8 + dashboards)*
  Gate `setJobStatus`; add an urgent/promised-date field; hand-off notifications via the existing Messages system; surface the cheap dashboard wins (per-salesperson scope, Storekeeper reorder tile, Estimator/Approver aging).

**Salman's confirmed calls so far:** Phase A + the metal half of Phase B are
authorized to build now; metal is *dropped* from routing and track products go to
the Curtain (track-making) department.
