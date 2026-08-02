# AMD — Al Maraya Decor Internal PWA — Project Reference

**This file is the primary reference going forward.** It merges the original
project-instructions PDF and the last hand-maintained `AMD-current-state.md`
with the actual current state of the repository (code, commit history,
ecosystem hub registry) as of **27 Jul 2026**. Both source files are kept
unchanged in the repo root for historical reference — `AMD-project-instructions.pdf`
and `AMD-current-state.md` — but this file supersedes them as the thing to
read first in any new session.

**Standing rule (Salman, 27 Jul 2026):** at the end of every working session
— or proactively, if a session senses it's approaching a context/length
limit — append a new dated entry to the **Session Log** section at the
bottom of this file (what was built/changed/fixed, new decisions + reasoning,
updated pending/next-steps, corrected wrong assumptions), then commit
(including this file) with a clear message. Note the standing push
limitation below before assuming "commit and push" fully lands.

---

## 0. Environment note — push access

**Update, 2 Aug 2026: push access confirmed working.** A push from this
environment directly to `origin/main` on `salmanabdullah13-arch/AMD-APP`
succeeded this session (merge commit `95f3938`) — no 403. The
previously-documented 403/`SendUserFile`-handoff workaround below may no
longer be needed; treat direct commit+push as the default going forward,
but stay alert for a 403 resurfacing (permissions can be revoked/environment
can change) and fall back to the old pattern if it does.

*Prior working pattern, kept for reference in case push breaks again:*
commit locally (with `git config user.email noreply@anthropic.com && git
config user.name Claude` reset first, since it doesn't persist across
sessions), then use `SendUserFile` to hand the changed files to Salman, who
applies and pushes them from his own local clone.

---

## 1. Project context (from the original instructions)

**Role:** Salman is owner of Al Maraya Decor, a Bahrain interior décor/fit-out
company, and sole developer of a custom internal PWA replacing the legacy
Q-Pro ERP. Vanilla JS/HTML/CSS only — no frameworks. Dark shell theme, light
Operations theme. Deployed via GitHub Pages (manual upload, historically —
this has since moved to a Claude Code + git workflow on the branch above).

**People:** Silva (Curtain & Blinds PM) · Stitch: Waseem, Aslam, Rijwan,
Ibrahim · Track: Abdullah, Prince · Install: Shibu, Sohail, Mushraf, Furqan,
Shahzad, Saeed · Nettworksy (external dev, receives handoff snippets) ·
Salman (owner, approves budgets over BD 5,000).

**Communication style:** Salman is terse and direct, works primarily on
iPad/iPhone. Explain simply before making architectural calls. Keep responses
scannable on a small screen.

**Domain rules that still hold, confirmed against current code:**
- BD cost figures never render in the Curtain UI — hours/quantities only;
  Operations (and now Accounts) are the cost gatekeepers. `curtain.js`
  explicitly comments this rule at the `CURTAIN_NAME_MAP` definition.
- Purchase Requests never require approval. Every PO and every Invoice does,
  regardless of origin (direct or converted from PR/PO) — enforced via
  `approvalStatus` gates on `purchaseOrders[]`/`purchaseInvoices[]`, absent
  on `purchaseRequests[]`.
- Every Storekeeper stock release requires a job — enforced in
  `releaseStockEntry()` (data.js) — no general/no-job release, so every
  release stays traceable via an `itemCard`.
- `curtainJobs[]`/`purchaseInquiries[]` (Curtain's own workshop tracker) and
  the `purchaseRequests[]`/`purchaseOrders[]`/`purchaseInvoices[]` chain are
  permanently separate systems, reconciled only as a read-only KPI rollup on
  the Purchasing dashboard — never merged.
- Unconfirmed figures (e.g. hardware recipe quantities) use explicit
  Confirmed/Unconfirmed/Needs Spec badges rather than being presented as
  trustworthy by default (see `curtain.js` fabric calculator).
- CSS injected into `<head>` must use `<style>` tags — raw text injection
  broke the shell before.

**Process rules — superseded/evolved, see Section 6 (Conflicts).**

---

## 2. Repository architecture

### File load order (`index.html`, fixed):
```
data.js → shell.js → operations.js → curtain.js → purchasing.js →
storekeeper.js → sales.js → estimator.js → approver.js → jobs.js → accounts.js
```
(The original instructions only listed the first 6 — `sales.js` through
`accounts.js` were added in later sessions; this is the current, complete,
correct order.)

### File sizes (rough sense of where the weight is):
`curtain.js` (5,873 lines) and `data.js` (3,339 lines) dominate; `purchasing.js`
(1,706) and `storekeeper.js` (833) grew substantially in the two most recent
"Q-Pro Batch" sessions; `index.html` (1,936 lines) holds the ecosystem hub SVG,
the Operations/Curtain/Purchasing static markup, and all `<script>` tags.

### Verification battery (run every session, every modified file — still the rule):
1. `node --check` on each modified file, and on the full concatenation in
   load order (cross-file global `const`/`let` collisions only surface this way).
2. Duplicate top-level function/const/let name scan (unindented top-level
   declarations only).
3. Cross-reference every `onclick`/`onchange`/`oninput` against defined functions.
4. (Added since the PDF was written) a closure-variable-in-inline-handler
   scan — `onX="varname.prop=..."` where `varname` isn't global — this
   pattern caused a real bug early in the Sales module build.
5. Playwright end-to-end flows against a local `python3 -m http.server`,
   screenshots read back for visual confirmation. See "Testing methodology"
   note below — some flakiness patterns are now well understood (Playwright's
   `.fill()` on a `type=number` input doesn't always fire the field's
   `change` handler the way `click → Ctrl+A → keyboard.type → Tab` does;
   don't mistake that for an app bug).

### Ecosystem hub — module status (from `index.html`'s `NODES` registry, the
source of truth for built vs. planned):

| Module (node id) | Status | Notes |
|---|---|---|
| Operations | ✓ built | 9 screens, full job lifecycle |
| Curtain & Blinds (`curtain`) | ✓ built | Silva's workshop + install, 6 screens |
| ↳ Tracks / QC / Install (sub-nodes) | ✓ built | Pipeline-board-style sub-dashboards — **this is the "Pipeline board" the old notes called "deferred, Salman's idea" — it has since been built** |
| Purchaser (`purchasing`) | ✓ built | Request → PO → Invoice, now includes Batch 1 additions (see §3) |
| Storekeeper (`storekeeper`) | ✓ built | Originally stock-pool release only; now the full Inventory module (Batch 2, see §3) |
| Sales (`sales`) | ✓ built | Enquiry + Quotation |
| Estimator (`estimation`) | ✓ built | Standalone module, own identity |
| Approver (`approvals`) | ✓ built | Standalone module, own identity |
| Jobs (`delivery`) | ✓ built | Job Card — post-Approval production/commercial tracking |
| Accounts (`accounts`) | ✓ built | Reporting dashboard, not Q-Pro-mapped (own addition) |
| Upholstery, Joinery, Painting | ✗ not started | Only Curtain has a built workshop module; these are placeholders |
| Owner Dashboard, HR & Payroll, Tally Bridge | ✗ not started | Unchanged from original plan |

**Known staleness:** the `M` object in `shell.js` (drives the ecosystem
tap-panel descriptions) still describes Purchaser and Storekeeper by their
*original* feature sets only — it does not mention Supplier Master, Cash
Ledger, Payment, Debit Note (Purchasing/Batch 1) or Item Master, Stock
Adjustment, Material Issue/Return, Stock Reports (Storekeeper/Batch 2). Cosmetic,
not functional — worth a small follow-up pass to refresh those two `M` entries.

---

## 3. Q-Pro ERP mapping — what's covered, and where the spec docs live

**No QPro mapping file is committed to this repo.** The Q-Pro reverse-engineering
specs ("Q-Pro Module Mapping — Batch 1: Purchases", "Batch 2: Inventory (+
PR addendum)") were uploaded ad hoc as chat attachments during live Q-Pro
testing sessions, not saved as repo files. If Salman wants them preserved for
future sessions, upload them once and commit as `docs/qpro-mapping/` — until
then, this section is the only persistent record of what they said.

### Modules built directly from a live Q-Pro reverse-engineering trace:
- **Sales (Enquiry + Quotation)** — matches live Q-Pro's Enquiry dashboard
  filters (Un Assigned/Un Attended/Un Quoted), the "convert only from a real
  Customer" rule, and the 3-step Quotation wizard.
- **Approver** — rebuilt from a full corrected live trace (pick model,
  lifecycleStatus semantics, comment channels, PO-approval tie-in). Two
  wrong assumptions were caught and fixed mid-build (see §5).
- **Job Card / Jobs module (Module 5)** — Job Card List, Management hub,
  Edit Job, Delivery Note, Materials Issue/Return, Update Job Status,
  Labour Cost, Purchase Request (Job) — all traced from a live spec.
- **Tax Invoice (Module 6)** — document layout intentionally styled as a
  distinct formal register (serif type, QR/bank placeholders, bilingual
  footer) vs. the dense ERP look elsewhere. Bank/QR details are explicit
  placeholders, not real payment integration.
- **Purchasing — Batch 1: Purchases** (committed `db866a7`):
  - **Supplier Master** (`suppliers[]`) — the one real canonical vendor list
    (Masters → Accounts → Vendor / `Supplier_master`), full field set (Name,
    Contact Person, Telephone ×2, Email, Fax, VAT Name/No, Tax %, Is Credit,
    Credit Limit/Days, full banking block, Address, CR No, Country, Opening
    Balance). **Deliberately does not replicate** Q-Pro's second, vestigial
    "Inventory → Vendor" list (internal route "Group"/"Stock Group",
    Name+Status only) — confirmed unused by any real transaction in the live
    system, so not rebuilt, on purpose, twice now (re-confirmed in Batch 2).
  - PO creation (Job/Others/Inventory variants, one shared numbering
    sequence) now requires a Supplier and a Cash/Ledger dropdown, with the
    exact live validation copy: *"Please select a Cash ledger"* and, for
    Job-type, *"Job No is required."*
  - Purchase Invoice two-stage flow: Submit → draft (Other Expenses field +
    totals summary) → Confirm (pink/magenta button) → enters the approval
    queue. Added Search PO Number/Locate and a Job Item allocation indicator
    (📎 / "Not allocated").
  - **Supplier Payment** and **Debit Note** — new modules, explicitly built
    to **fix**, not replicate, three confirmed reproducible bugs in the live
    system: the invoice-allocation table showing "No Invoice List
    Available..!" even for a vendor with a real open invoice; the Cash
    method's "Select" checkbox freezing the tab 30+ seconds; and "Create
    Payment"/submit freezing the tab while silently never persisting the
    record. All three are verified fixed here (Playwright-tested: allocation
    table populates real per-vendor open invoices, checkbox toggles
    instantly, the record shows up in the list immediately after create).
- **Inventory — Batch 2** (committed `280258c`):
  - **Item Master** (Masters → Inventory → Item) — full field set (Stock
    Category, Vendor, Catelog, VAT %, Stock Name/Code, Roll Width, Packing,
    Units, Cost/Avg. Cost/Selling Price, Reorder Level, Description,
    Purchase/Sales Allowed, Raw Material checkboxes).
  - Supporting masters: **Unit** and **Stock Category** (both pre-seeded
    with the real live option lists), **Catelog/Brand** (tied to a supplier).
    Same "don't replicate the vestigial Inventory→Vendor list" call as Batch 1.
  - **Stock Adjustment** — single-location ("Location 1" is the only value
    that exists in the live system — this app deliberately stays
    single-location too, matching it rather than building unused
    multi-location plumbing), signed-delta qty entry.
  - **Material Issue / Material Return** — new cross-job flattened list
    views (Transactions → Inventory → ...) built on top of the existing
    per-Job-Card move data rather than duplicating storage; added a working
    Cancel action that reverses the stock effect (matches the "cancelled"
    red/pink visual state observed live).
  - **Stock Reports** (Reports → Stock Ledger): Stock Report (true
    item-level ledger, replayed chronologically from opening stock), Item
    Summary Report (current snapshot), and **Job Material Requirement**
    (MRP-style reorder report with a working "Create Purchase Request"
    action on selected shortfall rows) — confirmed only "Inventory type"
    transactions referencing a real Item Master entry affect these, exactly
    matching the live system's stated behavior.
  - **Purchase Request addendum** — added the Division field and a
    read-only Project Details (Client/Project) panel to the existing PR
    create form, matching the live "Others" variant.
- **Accounts — Batch 3: General Ledger layer** (committed `169aa6b`, backfilled
  here from the session log — see §7, 27 Jul 2026 later entry, for the full
  build notes): Chart of Accounts (15 locked system Primary groups + 11 real
  custom sub-groups from the trace), Ledger master, General Receipt, General
  Payment (with per-line optional Job No), and Journal (balanced-entry-only,
  enforced in `createJournal()`). Sits underneath the pre-existing read-only
  KPI dashboard in `accounts.js`, not replacing it. Voucher Ledger Mapping
  (the Batch 5 config step that should resolve payment methods to real
  ledgers) was **not** built — Receipt/Payment/Journal lines pick a ledger
  directly, a fine simplification until Reports/Trial Balance need that
  mapping to post correctly.
- **Sales/Jobs — Batch 4: Sales & Job Operations** (traced from
  `docs/qpro-mapping/batch4salesandoperations.txt`): most of this batch's
  scope turned out to already be built (Enquiry Source, Meeting Type/Outcome
  follow-ups, Covering Letter/T&C templates, Job Card, Delivery Note,
  Materials Issue/Return, Update Job Status, Labour Cost, and the Sales/
  Estimator dashboard KPIs were all already live from the original Sales/
  Jobs build) — this pass filled the three genuine gaps the trace surfaced:
  - **Proforma** — system-generated only (no manual create form in the live
    trace, confirmed) via a new "Proforma" tile on the Job Card Management
    hub (`jobsGenerateProforma()`, jobs.js) and a list-only "Proforma" tab
    in Sales (`renderProformaList()`, sales.js). Numbered `P26AMD{seq}`,
    matching the live format.
  - **Sales Receipt** and **Sales Credit Note** — new Sales-module tabs,
    structurally mirroring Batch 1's Supplier Payment/Debit Note (two-stage:
    pick client, then a payment-method grid + invoice-allocation table). The
    live trace reports the identical "No Invoice List Available..!" bug here
    as Payment/Debit Note — fixed here, not reproduced, same call as Batch 1:
    `getCustomerOpenInvoices()` (data.js) actually looks the client's real
    open Tax Invoices up. Receipt allocations increment `paidAmount` on the
    invoice; Credit Note allocations increment a new `creditedAmount` field;
    both net off a shared `invoiceBalance()` helper. Credit Note list uses
    the same red/pink cancelled-row convention as Debit Note.
  - **Related-records wiring** — the Quotation Hub (sales.js) and Job Card
    Management hub (jobs.js) previously had a placeholder card reading
    "Invoices · Receipts · Credit Notes · Proforma · Delivery Notes — not
    built in this app." Both hubs now render real per-job mini-tables for
    all five via a shared `renderRelatedRecords()` helper (sales.js, called
    from both files since sales.js loads first in `index.html`'s script
    order). The Job hub's own Invoices table was upgraded to show
    Received/Balance columns now that `paidAmount`/`creditedAmount` exist.
  - **Sales Dashboard's Receivables KPI corrected** — `getSalesKPIs()`
    previously summed every invoice's full `netTotal` (flagged at the time
    as "an overstatement once payments exist"). Now sums `invoiceBalance()`
    across all Tax Invoices, netting off real Receipt/Credit Note activity.
    This mirrors, on the Sales/receivables side, the same still-open TODO
    on the Accounts/payables side noted below (Accounts' own KPIs still
    don't net off Batch 1's Payment `paidAmount`).
  - Verification: `node --check` on data.js/sales.js/jobs.js individually
    and the full 11-file concatenation; duplicate top-level declaration
    scan (none found); onclick/onchange/oninput cross-reference on both
    modified files (all resolve); closure-variable-in-inline-handler scan
    (none introduced); a standalone `vm.runInContext` smoke test drove a
    full Enquiry → Quotation → Job Card → Invoice → Proforma → partial
    Receipt → Credit Note → cancel lifecycle end-to-end and confirmed
    balances net correctly at each step. **Not Playwright-tested** —
    neither Playwright nor a local Python were available in this session's
    environment (both were available in earlier sessions per this file's
    prior notes); browser-level confirmation of the new tabs/forms is
    still outstanding and should be run for real before trusting this in
    production, same caveat as the Storekeeper device-test gap in §5.

### Custom modules NOT mapped from Q-Pro (built to fill gaps, explicitly flagged as this app's own design):
- **Estimator** and **Approver** as *standalone modules* with their own
  simulated user identities — Q-Pro treats these as distinct roles, not
  Sales sub-tabs, so this app mirrors that structurally even though the
  UI itself for Estimator's cost-plus BOM waterfall is this app's own design
  (cost-plus formula verified once against a live example: 5m × 2.000
  material → +5% Material OH → 10.500 → +30% profit → Selling Price 13.650,
  ×1.10 VAT → 15.015).
- **Accounts module** — explicitly NOT from a Q-Pro trace. Built as a
  read-only reporting layer over data this app already has (Revenue,
  Receivables, Payables, PO value awaiting delivery, cash-position proxy,
  revenue-by-division). No payment/receipt ledger exists at the Accounts
  level, so Receivables/Payables currently show full invoiced amounts, not
  true outstanding balances — **this is now slightly out of date since
  Batch 1's Payment module tracks real `paidAmount` per invoice; Accounts'
  KPIs haven't been updated to net that off yet** (see §5, pending work).
- **Ecosystem hub redesign** — numbered ①–⑤ pipeline badges
  (Sales→Estimator→Approver→Jobs→Accounts), hover/pulse interactivity,
  `updateEcosystemStats()` replacing a stale hardcoded "Built/Building/Planned"
  counter that had drifted for ~9 modules' worth of build sessions before
  being caught.

---

## 4. Key architectural / design decisions (with reasoning)

- **Three-way destination split, one helper.** PR/PO/Invoice all share a
  `destinationType`: `"inventory"` (shared stock pool) | `"job-direct"` |
  `"others"`, mapped to internal `type` via `destinationTypeToType()` in
  data.js — one function, reused everywhere, rather than 9 separate Q-Pro-style
  menu entries. A real bug here (any non-"job-direct" type silently collapsing
  to `"Stock"`) was caught and fixed before it could corrupt data, while adding
  the "Others" option.
- **Approval asymmetry is enforced in code, not just UI.** PRs never gate;
  POs and Invoices always do, whether direct or converted — `convertPOtoInvoice()`
  literally refuses to run on an unapproved PO.
- **Supplier data lives in exactly one place.** Every module that needs a
  vendor (PO, Invoice, Payment, Debit Note, now Item Master's Vendor field)
  reads from the same `suppliers[]` — no per-module duplication, and the
  known real-system duplicate (Inventory→Vendor) is a documented, deliberate
  non-feature.
- **Two-stage Invoice submission mirrors the live UX, minus its bug.** The
  real Q-Pro Purchase Invoice does Submit → draft → Confirm; this app
  reproduces the *flow* (own value: catches data entry mistakes before they're
  final) without the bugs found in Payment/Debit Note.
- **Real bugs get fixed, not reproduced — repeated pattern across two
  batches.** Both times the live system exhibited freeze/data-loss bugs
  (Payment, Debit Note), the instruction was explicit and was followed:
  build the working version, and say so in code comments so nobody
  "fixes" it back to match a broken reference later.
- **Item Master unification via a live alias, not a copy.** `ITEM_MASTER`
  (the name Estimator's BOM typeahead was built against) is now
  `const ITEM_MASTER = itemMaster;` — a live alias to the real Inventory
  Item Master, so anything created through Storekeeper's Item Master screen
  is immediately available in Estimator's Materials tab, and vice versa,
  anything picked from that typeahead auto-links (`addBOMMaterial` matches
  by exact name) so Job Material Requirement can see real demand. This was
  a deliberate consolidation opportunity taken mid-Batch-2, not a
  spec-mandated requirement — flagged here in case it turns out to be the
  wrong call once real users are typing item names that don't exactly match.
- **Stock Report is a replayed ledger, not a snapshot.** Rather than trusting
  `closingStock` alone, `getStockReport()` replays every voucher
  chronologically from `item.openingStock` so each row's running total is
  honest and internally consistent with the current live value — same
  spirit as double-entry bookkeeping, applied to a report that otherwise
  could silently drift.
- **Quotation lifecycle is a small explicit state machine.**
  `lifecycleStatus`: draft → open (only via Approver's Approve Quote) →
  confirmed (via Sales' Confirm Quote, creates a Job Card). `stage`: sales →
  estimator → approver → back to sales (cycle possible).
  `estimatorPickedBy`/`approverPickedBy` persist forever once set — a
  correction forced by a live trace that showed returning to a role lands
  directly in that person's queue, not back in "Pending to Pick."
- **`jobCards[]` (Module 5) is deliberately separate from `curtainJobs[]`**
  (Curtain's pre-existing production tracker) — an acknowledged open
  architectural question, not an oversight; unifying them is explicitly
  deferred to its own dedicated session because it touches Operations,
  Curtain, and Jobs simultaneously.
- **Mutual-exclusivity module hiding is a recurring bug class worth naming.**
  Every module's `open*Module()` must hide every *other* floating module's
  wrap, and this list has been incomplete at least twice: once early on
  (Sales/Approver DOM stacking), and again this session (`openPurchasingModule()`
  and `openCurtainModule()` were both missing `sk-module-wrap` from their
  hide-lists — a gap dating back to before Storekeeper existed, caught only
  because a cross-module Playwright test happened to chain Storekeeper →
  Purchasing). **Any new floating module must be added to every existing
  module's hide-list, and `goTo()` in shell.js, on the same day it's created** —
  this is now the single most common integration bug in this codebase.
- **Design tokens (`--biz-*` in styles.css) + per-module accent "zoning."**
  Shared structural tokens (radius, shadow, borders) but each module keeps
  its own accent hue matching Q-Pro's own per-transaction-area coloring:
  Sales-pipeline family = blue, Purchasing = lavender/mauve, Storekeeper =
  teal, Estimator = amber, Approver = crimson, Accounts = emerald.

---

## 5. Known issues / pending work

**Carried forward from the old notes, status resolved:**
- ~~sw.js / PWA offline support~~ — still **not built**, `sw.js` does not
  exist. Still open.
- ~~Real Reminders log~~ — **done**. `reminders[]` is real, seeded data in
  data.js; a duplicate `renderReminders()` stub that used to silently
  overwrite it in operations.js was found and removed (the Reminders tab
  used to show real data only until you navigated away and back once).
- ~~Pipeline board (Job → Window → Stitching/Track/QC/Ready for delivery)~~
  — **done**. Built as the Tracks/QC/Install sub-nodes under Curtain in the
  ecosystem hub.
- ~~Purchaser self-originate PR/PO/Invoice flows~~ — **done**, and further
  extended twice since (Batch 1 & 2).
- ~~Sales/Estimation module~~ — **done** (and further split into Estimator +
  Approver as their own standalone modules).
- ~~Real per-person BD/hr rates for WORKER_RATES~~ — **done**. Real
  fully-loaded rates for all ~70 employees now live in `EMPLOYEE_RATES`
  (data.js), built from actual payroll files (6 Jul 2026). One narrower TODO
  remains: the default EOSB tier should be replaced with per-person actual
  tenure once hire dates are confirmed (several entries, e.g. Owner/Directors,
  likely already exceed the 3-year tier).
- Storekeeper device-test checklist (search/release/partial-release/itemCard
  trace/no-job-blocked/over-qty-blocked) from the old notes was written
  against the *original* pool-release-only Storekeeper and was marked
  **NOT YET DEVICE-TESTED** at the time. Storekeeper has since been rebuilt
  substantially (Batch 2 adds 6 more tabs) — **recommend a fresh, full
  device-test pass covering both the original release flow and everything
  new**, rather than trusting the old checklist as still current.

**New, from this session's Batch 1/2 work:**
- Accounts module's Receivables/Payables KPIs don't yet net off Batch 1's
  real `paidAmount` per invoice — they still show full invoiced amounts.
  Small, contained fix (`getAccountsKPIs()` in accounts.js).
- `shell.js`'s `M` object descriptions for Purchaser and Storekeeper are
  stale relative to their actual current feature sets (see §2).
- Item Master "Create New Product" round-trip from a PO/Invoice line item
  is simplified to a text hint ("add it in Storekeeper → Item Master first")
  rather than a real inline modal — a deliberate scope cut for time, not a bug.
- `jobCards[]` vs `curtainJobs[]` unification remains an open, explicitly
  deferred architectural question.
- Multi-location Inventory is deliberately not built — the live system is
  single-location ("Location 1" only), matched intentionally.
- Upholstery, Joinery, Painting workshop modules, Owner Dashboard, HR &
  Payroll, and Tally Bridge remain fully unstarted (`built:false` in the
  ecosystem `NODES` registry).
- No QPro mapping spec files are committed to the repo (see §3) — worth
  fixing if Salman wants them preserved.

**New, from Batch 3/4 work (27 Jul – 2 Aug 2026):**
- Accounts module's own read-only KPI dashboard (`getAccountsKPIs()` in
  accounts.js — distinct from Sales' `getSalesKPIs()`) still doesn't net
  Batch 1's Payment `paidAmount` off its Payables figure. Sales' own
  Receivables KPI **was** fixed this session (now nets off Batch 4's Receipt/
  Credit Note activity via `invoiceBalance()`) — this remaining item is
  specifically the Accounts-module/Payables/purchase side, not yet touched.
- ~~Batch 4's Proforma/Receipt/Credit Note build was verified with `node
  --check`... but **not** in an actual browser~~ — **done**, 2 Aug 2026
  (later session): Playwright installed, full lifecycle browser-tested
  end-to-end, 28/28 checks passed, zero console errors. See Session Log.
- Voucher Ledger Mapping (Batch 5) remains unbuilt — Batch 3's GL entries
  and Batch 4's Receipt/Credit Note both pick a ledger/payment-method
  directly rather than through that resolution step. Fine for now; flag if
  Reports/Trial Balance get built on top and need it to post correctly.
- Batches 5 (Administration/Payroll/HR) and 6 (Reports) remain fully
  spec-only — archived in `docs/qpro-mapping/` but not built.

---

## 6. Conflicts found between the old notes and the current repo

Flagging these explicitly per Salman's request — confirm which reading is correct:

1. **Script load order.** The original PDF lists 6 files
   (`data.js → shell.js → operations.js → curtain.js → purchasing.js → storekeeper.js`).
   The actual current order in `index.html` has 11 files, ending
   `→ sales.js → estimator.js → approver.js → jobs.js → accounts.js`. Not a
   contradiction — the PDF simply predates those modules — but flagging so
   the PDF isn't mistaken for still-complete.
2. **"index.html is never hand-edited directly by Claude."** This was a
   hard rule under the earlier Claude-chat-based workflow (Claude had no
   direct file access, so it delivered replacement files or snippets for
   Nettworksy/Salman to paste in). Under Claude Code, `index.html` **is**
   edited directly and routinely, every session. This rule is **superseded**
   by the tooling change, not by a decision to relax it — worth an explicit
   "yes, this is fine now" or "no, still route through review" from Salman.
3. **"One major build task per session. Fresh chat per session."** Recent
   Claude Code sessions have carried multiple large batches of work across
   a single longer-running conversation (e.g. this session covers Batch 1
   AND Batch 2, back to back, plus this documentation task). This appears
   to be an intentional adaptation to the new tool rather than an oversight,
   but flagging since the original rule was called "non-negotiable."
4. **Old notes' "NEXT BUILD — pick one" list** (sw.js / Operations wiring /
   Reminders log) was written as the explicit next-session menu. What
   actually got built next instead was Sales, Estimator, Approver, Job Card,
   Tax Invoice, Accounts, then two full Q-Pro reverse-engineering batches —
   an entirely different, much larger scope. This reads as a deliberate
   change of direction (matches the subsequent "let's build [module] from a
   live Q-Pro trace" pattern of user messages across sessions) rather than
   the old notes being wrong, but it means **sw.js, the Operations
   getJobLoggedHours() cross-check UI, and job.accountsAlert-into-Operations
   wiring may still be genuinely wanted and simply never resurfaced** —
   confirm whether they're still on the roadmap.
5. **Storekeeper "NOT YET DEVICE-TESTED" status.** The old notes are explicit
   that the original release flow had never been confirmed working on a real
   device by Salman at time of writing. No evidence in the repo (commits,
   comments) that this device-test ever happened before Storekeeper was
   substantially rebuilt into the full Inventory module. If it was tested
   since, that's good news and this note can be deleted; if not, the
   original checklist items are still worth running for real before trusting
   the release flow in production.

---

## 7. Session Log

### 27 Jul 2026 — Compiled CLAUDE.md from old notes + full repo review
- Read `AMD-project-instructions.pdf` and `AMD-current-state.md` in full
  (both already present in the repo root, matching the freshly-uploaded
  copies exactly — no drift between them).
- Reviewed current repo state: all 11 JS modules, `index.html`'s ecosystem
  `NODES` registry (source of truth for built/planned status), `shell.js`'s
  `M` object, full commit history (33 commits from initial upload through
  Batch 2: Inventory).
- No QPro mapping spec file exists in the repo — those were chat uploads
  only; recorded their content/coverage here instead (§3).
- Compiled this file merging both sources; flagged 5 explicit conflicts
  between the old process rules and current Claude Code workflow (§6) for
  Salman to confirm rather than silently resolving them one way.
- Established the standing rule (this file, top of doc): update this Session
  Log at the end of every session or proactively near a context limit, then
  commit. Old notes file (`AMD-current-state.md`) is kept as-is, not deleted,
  per instruction — this file is now the one to read first.
- **No code changed this session** — this was a documentation-only pass.
- **Next steps (not yet started, for whoever picks this up):**
  1. Confirm the 5 conflicts in §6 with Salman.
  2. Decide whether to do a fresh Storekeeper device-test pass (old checklist
     + everything new from Batch 2).
  3. Small fix: net Batch 1's real `paidAmount` off Accounts' Receivables/Payables KPIs.
  4. Small fix: refresh `shell.js`'s `M` object descriptions for Purchaser/Storekeeper.
  5. Decide fate of sw.js / Operations wiring / EOSB tenure TODO — still wanted or fully superseded by the Q-Pro batch work.

### 27 Jul 2026 (later same day) — Archived batch specs, built Batch 3 (Accounts GL layer)
- Found the 6 Q-Pro batch mapping `.txt` files loose at the repo root (Batches
  1–6, including 4 — Sales & Job Operations, 5 — Administration/Payroll/HR,
  and 6 — Reports — that this file's §3 didn't know about yet, since they'd
  never been read). Reviewed all 6 in full.
- Moved them into `docs/qpro-mapping/` with clean filenames
  (`batch-1-purchases.txt` … `batch-6-reports.txt`) and committed — closes
  the "no QPro mapping spec file is committed" gap flagged in §3/§5.
- **Built Batch 3: Accounts — General Ledger layer**, traced from
  `docs/qpro-mapping/batch-3-accounts.txt`. This is new — the pre-existing
  Accounts module (`accounts.js`) was a read-only KPI dashboard only; it now
  also has a real bookkeeping layer underneath it, added as new tabs in the
  same module (no new floating module, so no hide-list/`goTo()` changes
  needed):
  - **Chart of Accounts** (`accountsGroups[]` in data.js) — the 15 real
    system Primary groups (locked/non-editable, matches live) + the 11 real
    custom sub-groups from the trace (Customers, Suppliers, Sales, Duties &
    Taxes, Purchases, Cash Accounts, Bank Accounts, Salary & Staff Costs,
    Staff Salaries, Machinery Repair & Maintenance, Tools & Equipment), each
    tagged with an Asset/Liability/Income/Expense classification. New
    custom groups can be added under any Primary; Primary groups can't be
    edited, matching the live system's own Edit-action restriction.
  - **Ledger master** (`ledgers[]`) — seeded with every ledger name already
    referenced elsewhere in this app (Purchase, the CASH_LEDGERS list) plus
    the real GL account names named in the trace (Sales, Sales Return, VAT,
    Printing & Stationery, Project Cost - Commission, etc.). No separate
    "Bank" master, on purpose — a bank account is just a Ledger under "Bank
    Accounts" with the banking fields filled in, matching Q-Pro exactly.
  - **General Receipt** — pure GL-coded receipt, no Customer/Invoice link
    (confirmed live: the Ledger autocomplete rejects a customer name).
  - **General Payment** — same 5-mode payment header (Cash/Bank/C
    Card/Wallet/Cheque, auto-summed Amount) as Receipt, but each allocation
    line can optionally carry a Job No — matches the live system's real
    use case (refunding a customer advance tied to a job). Has a Cancel
    action (red/pink row highlighting, matches the live convention).
  - **Journal** — free-form multi-line double entry, minimum 2 rows,
    extendable via "+ Add a new Row." Debit total must equal Credit total
    or `createJournal()` refuses to save — enforced in code, not just the
    UI, mirroring the same "gate it for real" pattern used for PO/Invoice
    approvals in Batch 1.
  - All three (Receipt/Payment/Journal) validate that ledger-allocation
    lines sum to the header Amount before saving ("Please check entered
    Amount." — the exact live validation copy) — data.js functions
    `createGeneralReceipt`/`createGeneralPayment`/`createJournal`.
  - UI: line-item forms use a fixed-row-count-with-progressive-reveal
    pattern (`acAddLineRow`, up to 6 rows) rather than full re-render on
    "+ Add Row," specifically to avoid wiping already-entered input values
    — a re-render-based add-row would have silently lost data entered in
    earlier rows.
- **Verification run:** `node --check` on every modified file individually
  and on the full 11-file concatenation in load order; duplicate top-level
  declaration scan (none found); every `onclick`/`onchange`/`oninput` in
  accounts.js cross-referenced against defined functions (all resolve);
  closure-variable-in-inline-handler scan (none found); data-layer logic
  smoke-tested standalone via `vm.runInContext` (group/ledger creation,
  balanced + intentionally-unbalanced Receipt/Journal, payment cancel);
  full Playwright pass against `python3 -m http.server` — Journal, General
  Receipt, and Chart of Accounts all confirmed working end-to-end in an
  actual browser, screenshots read back. Only pre-existing, unrelated
  console errors observed (`sw.js` 404 — already a known pending item;
  `favicon.ico` 404).
- **Environment note confirmed still current:** `git push` to this branch
  returned 403, same as documented in §0. Committed locally as `Claude
  <noreply@anthropic.com>`; Salman needs to pull these commits from his own
  clone and push.
- **Not done this session, still open:** Batch 4 (Sales & Job Operations
  detail), Batch 5 (Administration/Payroll/HR — the real HR & Payroll
  module), and Batch 6 (Reports) remain spec-only, now safely archived in
  `docs/qpro-mapping/` but not yet built. §3 of this file should get a
  proper writeup of Batch 3's coverage (and Batches 4–6's scope) next time
  there's room — this log entry is the only record of it for now. Voucher
  Ledger Mapping (Batch 5) — the config step that's supposed to resolve
  each payment method to a real ledger — was not built; Receipt/Payment
  line ledgers are picked directly instead, which is a fine simplification
  for now but worth flagging if Reports/Trial Balance ever get built on top
  of this and need that mapping to post correctly.

### 2 Aug 2026 — Resolved a diverged push, built Batch 4 (Sales & Job Operations)

- **Git housekeeping first:** Salman's prior local Batch 3 commit (`169aa6b`)
  had been made on top of an older `origin/main`; GitHub had since gained a
  divergent commit (`7aa00cb`, Salman uploading the 6 raw QPro spec `.txt`
  files at repo root via the GitHub web UI). Fetched, confirmed the two
  commits touched entirely disjoint paths (root loose files vs. the cleaned
  `docs/qpro-mapping/` copies), merged clean (`95f3938`), and pushed straight
  to `origin/main` from this environment. **Correction to §0: push access
  is not actually 403'd here** — a direct push succeeded this session. Left
  §0 updated to say so but kept the old SendUserFile fallback documented in
  case it regresses.
- **Built Batch 4: Sales & Job Operations**, traced from
  `docs/qpro-mapping/batch4salesandoperations.txt` (a copy of this was also
  independently re-uploaded to Salman's Downloads folder mid-session and
  diffed byte-identical against the archived copy — no drift, confirmed
  read-only). Full coverage detail is in §3 (Q-Pro mapping section) rather
  than repeated here. Short version: most of this batch's nominal scope
  (Enquiry Source/Meeting Type/Outcome, Job Card, Delivery Note, Materials
  Issue/Return, Update Job Status, Labour Cost, Sales/Estimator dashboard
  KPIs) turned out to already exist from the original Sales/Jobs build —
  reviewed sales.js and jobs.js in full before writing anything, specifically
  to avoid rebuilding what was already there. The three real gaps the trace
  surfaced and this session actually built: **Proforma** (system-generated
  only, wired into both the Job Card hub and a new Sales list tab),
  **Sales Receipt** and **Sales Credit Note** (new Sales-module tabs,
  structurally mirroring Batch 1's Supplier Payment/Debit Note — including
  fixing the same "No Invoice List Available..!" bug the live trace reports
  here, not reproducing it), and wiring real data into the "Related
  records" sections of both the Quotation Hub and Job Card Management hub,
  which had been explicit placeholder text ("not built in this app") since
  the original build.
- **Decision: reused the Payment/Debit Note pattern from Batch 1 rather than
  inventing a new one** for Receipt/Credit Note, since the live trace
  describes structurally the same two-stage flow (pick client → payment-
  method grid + invoice-allocation table) just on the customer side. Also
  reused `getVendorOpenInvoices()`'s exact shape for the new
  `getCustomerOpenInvoices()` so the allocation-table UI code could be
  near-identical to Purchasing's existing Payment form.
- **Correction made along the way:** Sales' `getSalesKPIs()` Receivables
  figure was previously flagged in its own code comment as "an overstatement
  once payments exist" (no receipt tracking existed at the time it was
  written). Now that Receipt/Credit Note are real, corrected it to sum
  `invoiceBalance()` (Net Total − paidAmount − creditedAmount) across all
  Tax Invoices instead of raw `netTotal`. The equivalent issue on the
  Accounts-module/Payables side (from Batch 1) is still open — see §5.
- **Verification:** `node --check` on data.js/sales.js/jobs.js individually
  and the full 11-file concatenation in `index.html` load order; duplicate
  top-level declaration scan across all 11 files (none found); onclick/
  onchange/oninput cross-reference on both modified files (all resolve);
  closure-variable-in-inline-handler grep (none introduced — the two
  pre-existing instances in jobs.js/sales.js are unrelated direct-global
  assignments, not a new bug). **Playwright was not available in this
  session's environment** (neither `npx playwright` nor a `python3`/`py`
  interpreter for a local server were found) — substituted a standalone
  `vm.runInContext` data-layer smoke test instead: ran a full synthetic
  Enquiry → Quotation → (manually flipped to Open, bypassing the
  Estimator/Approver stage since that flow is already covered by prior
  sessions' tests) → Job Card → Tax Invoice → Proforma → partial Sales
  Receipt → Sales Credit Note → cancel lifecycle, confirming
  `invoiceBalance()` nets correctly at every step and error paths
  (`"Please select a client."` / `"Amount is required."`) fire correctly.
  **This is a logic-only pass, not a browser confirmation** — flagged in
  §5 as still owed, same caveat class as the long-standing Storekeeper
  device-test gap.
- **Next steps:** run an actual browser/Playwright pass on the new Receipt/
  Credit Note/Proforma UI once tooling is available; decide whether to
  build Batch 5 (Administration/Payroll/HR) or Batch 6 (Reports) next —
  both remain fully spec-only; consider the still-open Accounts/Payables
  KPI netting fix (small, contained, same shape as the fix just made on
  the Sales side).

### 2 Aug 2026 (later same day) — Playwright installed, full lifecycle browser-tested (closes the Batch 4 testing gap)

- **Installed Playwright** (`@playwright/test` 1.62.1 + Chromium) as a dev
  dependency in a new `package.json` at the repo root, so future sessions
  in this environment have real browser automation available instead of
  falling back to `vm.runInContext` logic-only smoke tests. Added
  `.gitignore` (`node_modules/`, `*.png`, `*.log`, `test-results/`,
  `playwright-report/`) since this is the repo's first Node tooling.
- **Ran a full end-to-end lifecycle test in a real headless Chromium
  browser** (`e2e-lifecycle.js`, committed, reusable): PIN unlock → Create
  Customer → Create Enquiry → Convert to Quotation (3-step wizard) →
  Estimator (pick + transfer) → Approver (pick + approve) → Sales Confirm
  Quote (creates Job Card) → Tax Invoice → Proforma → Sales Receipt
  (partial payment) → Sales Credit Note → Related Records tables on both
  the Quotation Hub and Job Card hub. **28/28 checks passed, zero console
  or page errors the entire run.** Verified against real in-app state via
  `page.evaluate()` reads of `quotations`/`jobCards`/`taxInvoices`, not
  just rendered text — e.g. confirmed `invoiceBalance()` nets correctly:
  BD 82.500 net − BD 30 paid − BD 10 credited = BD 42.500 balance. The
  documented "No Invoice List Available" bug-fix (§3) holds for both
  Sales Receipt and Sales Credit Note in a real browser, not just in the
  data layer. **This closes the "not yet Playwright-tested" gap flagged
  in §5 after Batch 4** — Batch 4's Proforma/Receipt/Credit Note UI is now
  confirmed working end-to-end in an actual browser.
- **No real app bugs found.** A couple of things that looked broken during
  scripting turned out to be test-selector scoping issues (see below), not
  product defects — reproduced clean on a second run after fixing the
  selectors.
- **Non-bug findings worth a decision from Salman:**
  1. Ecosystem hub is confirmed genuinely mobile-only — at a desktop
     viewport the node icons render off-screen, no desktop fallback exists.
     Matches the documented iPad/iPhone-only design intent; not a bug.
  2. `shell.js`'s `showPanel()` info-panel + "Open X Module →" button is
     now **dead code for every built module** — `index.html`'s newer
     `handleNodeTap()` intercepts node taps and launches modules directly
     (`window._ecoDirectLaunch`), so the panel's launch-button path is
     unreachable. Arguably better UX (one tap instead of two) but worth a
     cleanup pass to remove the dead path, or confirm it's still needed
     for some untested case.
  3. Picking a quotation in Estimator or Approver does not auto-navigate
     into its review screen — `estimatorPick()`/`approverPick()` just
     re-render the dashboard; the user then has to separately open "My
     Actions"/"For Approval" and click the row. Consistent on both
     modules — confirm whether this is intentional or unwanted friction.
  4. Generating a Tax Invoice navigates fully away from the Job Card hub
     (only a "‹ Back to Job Card" link remains), so Proforma/Delivery
     Note/Material tiles are briefly out of reach. Expected given the
     invoice's intentionally distinct document styling (§3), just noting
     for anyone training staff on this flow.
  5. **The app ships with pre-seeded demo data** (an enquiry, an open
     quotation, one already "with Estimator") visible immediately on first
     PIN unlock — not previously documented anywhere in this file. Real
     open question: is this meant to ship to production/real users, or
     should it be stripped before go-live? Also caused a genuine test
     hazard worth noting for future Playwright work: a loosely-scoped
     `:has-text()` selector matched the seeded quotation's button instead
     of a freshly-created one, since both were text-match ancestors of the
     same DOM subtree — broad `:has-text` combinators can cross-match
     unrelated seeded rows, not just hidden elements from other modules
     (the existing Playwright-flakiness note in §2 was about `.fill()` on
     number inputs; this is a second, distinct flakiness class worth
     knowing).
- **Artifacts committed:** `package.json`, `package-lock.json`, `.gitignore`,
  `smoke-test.js` (minimal PIN-unlock-and-screenshot check), `e2e-lifecycle.js`
  (the full reusable lifecycle test, safe to re-run in future sessions to
  catch regressions). Screenshots (`e2e-shots/`, `smoke-test.png`) are
  gitignored — regenerate by running the scripts, not restored from git.
- **Next steps:** decide on item 5 above (seeded demo data) before any
  go-live; optionally clean up the dead `showPanel()` launch-button path
  (item 2); still open from prior sessions — Accounts/Payables KPI
  netting fix, Batch 5/6 build decision, `shell.js` `M` object staleness
  refresh (§2), `jobCards[]`/`curtainJobs[]` unification.
