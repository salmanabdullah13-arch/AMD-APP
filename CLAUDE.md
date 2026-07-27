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

This Claude Code environment's git push to `salmanabdullah13-arch/AMD-APP` is
**persistently 403'd**. The working pattern every session: commit locally
(with `git config user.email noreply@anthropic.com && git config user.name Claude`
reset first, since it doesn't persist across sessions), then use
`SendUserFile` to hand the changed files to Salman, who applies and pushes
them from his own local clone. Commits made this way are real, correctly
authored, and sitting on `claude/enquiry-module-build-bm5bna` — GitHub will
flag them "Unverified" until Salman actually pushes them (expected, not a bug).
If this changes (push access restored), update this section.

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
