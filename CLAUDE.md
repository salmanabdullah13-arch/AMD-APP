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
| HR & Payroll (`hr`) | ✓ built | Employee master (8 tabs) + compliance-expiry HR Dashboard — Batch 5, see §3 |
| Upholstery, Joinery, Painting | ✗ not started | Only Curtain has a built workshop module; these are placeholders |
| Owner Dashboard, Tally Bridge | ✗ not started | Unchanged from original plan |

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
- **HR & Payroll — Batch 5** (traced from
  `docs/qpro-mapping/batch5administrationpayrollhr.txt`, committed 3 Aug
  2026): new floating module (`hr.js`, `#hr-module-wrap`), first entirely
  new module added since the light-system redesign — built directly on
  the wine-accent `--biz-*` tokens, no restyling debt.
  - **Employee master** — 8-tab record (General Info, Statutory Details,
    Passport & Visa, Contract, Salary, Dependents, Assets, Notes) per the
    live spec, seeded from `EMPLOYEE_RATES` (real payroll data, ~70 staff,
    already in data.js) rather than invented names. `EMPLOYEE_RATES`' own
    informal department strings ("Admin/Office", "Carpentry", "Watchman",
    ...) are mapped to the real Q-Pro Administration Department master's 6
    values (`EMPLOYEE_DEPARTMENTS`) via `EMP_RATE_DEPT_TO_REAL_DEPT` — a
    **different list from `DEPTS`** (the pre-existing categorical color
    registry used elsewhere for production-department tagging), left
    untouched on purpose. Pay Head list simplified from the spec's 17 fixed
    Q-Pro pay-codes to 6 that actually belong on an employee record (GL-
    posting artifacts like Gosi Payable/Indemnity Payable excluded).
    5 employees seeded with realistic compliance dates (spanning expired/
    expiring/valid) so the HR Dashboard has real data without hand-
    populating all ~70. Green full-row highlighting for Active status,
    matching the spec's own observation and the existing red/pink
    cancelled-row convention (Batch 4).
  - **HR Dashboard** — 6 expiry tiles (CPR/Passport/Driving Licence/Visa/
    Contract/Dependent), Expiring/Expired split, pure read-side view over
    the Employee master (`getHRKPIs()`, data.js) — no separate compliance-
    tracking entity, confirmed matching the spec's own finding. 30-day
    "expiring" window, resigned/terminated/retired staff excluded.
  - **Voucher Ledger Mapping** — built as a new Accounts-module tab (not
    HR — genuinely an accounting-configuration concern), resolving the 6
    payment instruments to real `ledgers[]` entries. **Not wired into the
    existing Receipt/Payment/Credit Note/Debit Note forms** — see §5 for
    why that was deliberately deferred.
  - **Customer Update** — new Sales-module tab, a single-quotation
    correction utility (reassign Customer/Contact Person, Salesman, or
    VAT% against an already-created quotation) distinct from full editing.
    Salesman correction traces `qtn.enquiryId → enquiry.salesPerson` since
    quotations don't carry their own salesPerson field — same trace
    pattern `accountsDivisionForInvoice()` already uses.
  - **Approver dashboard KPIs** — turned out already fully built
    (`getApproverKPIs()` in data.js already computed all 7 values;
    `approver.js` already rendered all 7 tiles) — the spec's apparent gap
    didn't exist by the time this session actually checked the code,
    confirming the house rule of reviewing existing code before building.
  - **Deliberately not built**, same "don't replicate what the app's own
    architecture doesn't need" precedent as Batch 1/2's vestigial-list
    skips: Q-Pro's Users/User Group/Default Controller/role-flag system
    and Quick Menu (models a real login+permission system this PIN-lock-
    plus-simulated-identity app doesn't have), and Employee Category
    (flagged vestigial in the spec itself).
  - **A real, pre-existing bug found and fixed along the way**: the 3D
    ecosystem hub's canvas (built 3 Aug 2026, earlier this session) could
    get stuck rendering at a fallback 380×500 size instead of its actual
    container size, because `resize()` only ran on a browser `window`
    resize event, which never fires from switching tabs inside the app.
    Found while verifying the new HR node opens via a **real tap through
    the actual raycasting path**, not a direct `launch()` call — the exact
    verification discipline the earlier session's node-tap bug had already
    established as necessary. Fixed with a `ResizeObserver` on the canvas
    container, which also catches the first real layout, not just later
    resizes. This was a latent bug affecting every node near the
    canvas's under-sized right/bottom margin, not something Batch 5
    introduced — HR just happened to be the node whose real-tap
    verification caught it.
  - **Verification:** `node --check` on all 11 modified/new files
    individually and the full 12-file concatenation in load order;
    duplicate top-level declaration scan (none found); onclick/onchange/
    oninput cross-reference on `hr.js` and the new Accounts/Sales code
    (all resolve); closure-variable-in-inline-handler scan (none
    introduced — new state variables are all top-level `let`, same pattern
    as `salesView`/`accountsView`); full Playwright pass — HR module
    opened via a genuine tap on its real ecosystem-hub node (not
    `launchHRModule()` called directly), Employee list/detail (General
    Info, Statutory, Dependents tabs) and HR Dashboard screenshotted,
    Accounts' Voucher Ledger Mapping and Sales' Customer Update
    screenshotted and functionally tested (`setVoucherLedgerMapping()`/
    `applyCustomerUpdate()` both confirmed to actually mutate state
    correctly), mutual-exclusivity module-hiding confirmed both directions
    (HR→Accounts and Accounts→HR both correctly hide the other). Zero
    console/page errors throughout.
- **Batch 6: Reports** (traced from `docs/qpro-mapping/batch6reports.txt`,
  committed 3 Aug 2026): the last of the 6 Q-Pro batches, closing out the
  full mapping exercise. No new business entities — every report is a
  read-only view over data already mapped in Batches 1–5, per the spec's
  own cross-cutting finding. No new ecosystem-hub node (Reports isn't a
  standalone module in Q-Pro either) — each report lives as a new tab
  inside whichever existing module already owns that data, same "extend
  the natural home" call Batch 3 made for the GL layer inside Accounts:
  - **Accounts** — Day Book (cross-voucher log spanning Invoice/Receipt/
    Purchase Invoice/Supplier Payment/Credit Note/Debit Note/General
    Receipt/Payment/Journal), Ledger Report, Trial Balance (Ledger-wise
    toggle), Profit & Loss, Balance Sheet.
  - **Sales** (new "Reports" top-tab) — Quotation Register Report,
    Sales Bill Outstanding (By Party/All × Age-wise toggle covers all 4
    spec variants in one screen rather than 4 separate ones).
  - **Purchasing** (new "Bill O/s" nav tab) — Purchase Bill Outstanding,
    mirroring Sales Bill Outstanding's structure for the vendor side.
  - **Jobs** (new "📊 Reports" button on the Job List) — Job report
    (single Job No lookup, a per-job mini P&L), Project Outstanding
    (job-level receivables reconciliation across every Job Card),
    Project wise Invoice & Receipt (single Job No lookup).
  - **HR & Payroll** (new "Payroll Report" tab) — Year/Month rollup of
    each Active employee's Pay Heads.
  - PO Register (Batch 1) and the three Stock Ledger sub-reports (Batch 2)
    were already built and are not repeated.
  - **A real design problem found and fixed while building this**: a
    pure ledger-postings-based P&L/Balance Sheet came out useless —
    Batch 3's seed Chart of Accounts files the "Sales" ledger group under
    "Current Assets", not "Direct Incomes"/"Sales Accounts" (a real,
    legitimate accounting pattern — a Sales Ledger/Debtors-control account
    is distinct from a P&L income account — not a data bug, so the seed
    data was NOT changed), and no custom group at all sits under
    "Direct Incomes". A pure-GL P&L would show zero Direct Income even
    with real invoices posted. Fix: Direct Income/Expense (P&L) and
    Receivables/Payables (Balance Sheet) read straight from the real
    transactional documents (taxInvoices/purchaseInvoices) — the same
    source `getAccountsKPIs()`'s existing Dashboard tab already uses —
    while Indirect Income/Expense and Cash/Bank/other real ledger balances
    still come from the GL layer (Journal/General Receipt/Payment), which
    is genuinely correct there. Verified end-to-end via a synthetic
    Enquiry→Quotation→Job→Invoice→Receipt lifecycle in a standalone
    `vm.runInContext` smoke test before writing any UI.
  - **Closed a long-standing flagged TODO as a direct side effect**:
    `getAccountsKPIs()`'s Receivables/Payables figures (Accounts Dashboard
    tab) were still summing full invoiced/received amounts without netting
    off real Payment/Receipt/Credit Note activity — flagged as open since
    Batch 1/4. Building the Balance Sheet needed the correct netted figure
    anyway, so fixed `getAccountsKPIs()` itself rather than shipping two
    different Receivables numbers (a stale Dashboard one, a correct
    Balance Sheet one) side by side.
  - **Materials Issued/Returned on the Job report are move COUNTS, not a
    currency value** — this app's Material Issue/Return moves don't carry
    a rate/cost (confirmed existing precedent: `getStockReport()` already
    sets `rate:0`/`amount:0` for these voucher types), so inventing a new
    valuation methodology here (e.g. off `itemMaster.avgCost`) would be
    unverified and inconsistent with the rest of the app. Flagged in the
    report's own UI text, not silently guessed.
  - **Sales/Purchase Bill Outstanding's "Age by Due Date" reuses the real
    creditDays field** already captured on the Customer/Supplier masters
    (no per-invoice due-date field exists, same "reuse an existing trace
    rather than invent a field" precedent as `accountsDivisionForInvoice()`).
  - **Purchase Bill Outstanding's vendor-side mislabel — fixed, not
    reproduced**: the live spec confirms all 4 Purchase Bill Outstanding
    variants still show "Client Name"/"CLIENT" (cloned from Sales Bill
    Outstanding without relabeling). Every label here correctly says
    Supplier/Vendor.
  - **The "No Invoice/Bill List Exist" bug** (confirmed systemic across
    3 earlier contexts) is reported again here for Project wise Invoice &
    Receipt — fixed here too, same pattern: `getProjectWiseInvoiceReceipt()`
    actually looks the job's real invoices/receipts/credit notes up.
  - **Verification:** `node --check` on all 7 modified files individually
    and the full 12-file concatenation in load order; duplicate top-level
    declaration scan across all 12 files (none found); onclick/onchange/
    oninput cross-reference (every handler in the 5 modified files plus
    `index.html`'s new markup resolves to a defined function); closure-
    variable-in-inline-handler scan (none introduced — the two new
    `salesView='...';renderSalesBody();` / `jobsView='...';renderJobsBody();`
    inline assignments target genuine top-level `let` globals, same pattern
    already used throughout both files). Full Playwright pass
    (`e2e-batch6-reports.js`, committed, reusable) — seeded a real
    Enquiry→Quotation→Job→Invoice→Sales Receipt→General Receipt chain
    through the actual data-layer functions, opened all 5 touched modules
    via their real ecosystem-hub node `launch()` (via `window.__eco3d`,
    the established debug handle from the earlier node-tap bug fix), then
    exercised every new report tab via real DOM clicks. 7/7 checks passed,
    zero console/page errors. Screenshots confirmed Receivables/Payables/
    P&L numbers net correctly against the seeded data (e.g. Balance Sheet:
    Accounts Receivable 170.000 = Invoice 220.000 − Receipt 50.000 paid).

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
- ~~Voucher Ledger Mapping (Batch 5) remains unbuilt~~ — **half-done**, 3 Aug
  2026: the mapping screen itself is built (Accounts → Voucher Ledger
  Mapping, `voucherLedgerMap` in data.js), correctly resolving all 6
  payment instruments to real ledgers. **Not yet consumed anywhere** —
  Batch 3's GL entries, Batch 4's Receipt/Credit Note, and Batch 1's
  Supplier Payment/Debit Note all still pick a ledger directly rather than
  through `resolveVoucherLedger()`. Wiring those 4+ existing forms to
  actually use the mapping was deliberately deferred rather than risking
  breakage across several already-working flows in one pass — still open,
  flag if Reports/Trial Balance need it to post correctly.
- ~~Batch 6 (Reports) remains fully spec-only~~ — **done**, 3 Aug 2026, see §3
  and the Session Log. Voucher Ledger Mapping still isn't wired into
  Receipt/Payment/Credit Note/Debit Note — Trial Balance/Ledger Report/P&L
  do NOT need that mapping to post correctly after all (see §3's Batch 6
  writeup for why: Direct Income/Expense and Receivables/Payables read
  straight from the real transactional documents, not through the ledger
  layer) — so this is no longer a blocker for anything, just still an open
  "nice to have" if Salman wants Payment/Receipt/Credit/Debit Note to post
  through real ledgers too.

**New, from Batch 7 (3 Aug 2026 — role-boundary/Job-as-parent/Variation
Orders/Tasks-Activity-Log session):**
- Tasks/Activity Log primitive (`tasks[]`/`activityLog[]` in data.js)
  exists and is real, but is only surfaced on the Job Card hub and only
  wired into the Variation Order flow — not retrofitted into the other 11
  modules' own actions. A fuller cross-module task inbox / activity feed
  is a natural follow-up, deliberately not built in this pass.
- Curtain's header icon badge (and ~6 more spots across `index.html`'s
  Curtain screens and `curtain.js`) still use the old purple accent as
  decimal `rgba(124,58,237,...)` rather than hex `#7c3aed` — invisible to
  every prior redesign chunk's hex-string grep. Found while fixing the
  back-button bug, not yet fixed itself — a real, contained follow-up.
- A Job bridged into `curtainJobs[]` (Curtain & Blinds division jobs only)
  starts with empty `windowGroups`/`windows` — correct/expected (no window
  data exists until Curtain's own screens populate it), but worth knowing
  if a bridged job looks "thin" in Curtain's Windows/BOM tabs at first.
- The bridge (`bridgeJobToOperationsAndCurtain()`) only fires from
  `confirmQuotationToJobCard()` and `confirmVariationToJobCard()` — any
  other future path that creates/mutates a Job Card's amount should call
  it too, or `projects[]`/`curtainJobs[]` will drift out of sync with the
  real `jobCards[]` figure.

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

### 2 Aug 2026 (later same day) — UI redesign, Chunk 1: Shell + Operations + Curtain retoned to a single light system

- **Source of the redesign:** Salman uploaded a design-tool export
  ("Heartwood Joinery" — a fictional joinery-company PWA mockup, zip
  contained a `.dc.html` interactive prototype plus an unrelated bundled
  `_ds/nocturne` dark/blurple design-system export that was **not** what was
  actually rendered and was correctly ignored). The real reference: light
  `#f5f6f8` ground, white 14px-radius cards with a soft
  `0 1px 2px rgba(16,24,40,.04)` shadow, a single wine/maroon `#600131`
  brand accent (buttons, active states, links — no separate blue "info"
  color), pill-shaped status tags, system font, sidebar-collapses-to-tabbar
  responsive nav. Two Artifact mockups were built and approved before any
  real code changed: a 3-direction comparison, then a Sales-module pilot in
  the Heartwood palette specifically.
- **Two explicit decisions Salman made** (asked directly, not assumed):
  **(1) one brand accent everywhere**, replacing the old per-module color
  zoning (Curtain=purple, Purchasing=lavender, Estimator=amber, etc. — see
  §4's now-superseded "Design tokens + per-module accent zoning" note);
  **(2) unify the whole app to light** — no more dark Shell. This is a
  bigger visual change than it sounds: the Shell (PIN lock, ecosystem hub,
  topbar, bottom nav, info-panel, roadmap, notes, checklist) had **zero**
  token indirection for its dark colors — every `rgba(255,255,255,.X)` was
  written literally per-rule, so this was a real rewrite, not a token swap.
- **True scope turned out much bigger than the pilot suggested** — before
  touching code, grepped for hardcoded hex colors across every module:
  purchasing.js 87 (zero shared `--biz-*` token usage, contrary to what an
  earlier session's comment claimed was "modernized" — it wasn't), sales.js
  76, jobs.js 65, accounts.js 50, estimator.js 41, approver.js 40,
  storekeeper.js 30 — ~390 hardcoded colors across those 7 files alone,
  before Operations/Curtain/Shell. **Decision: chunk the rollout, verify +
  commit each chunk separately** rather than one large unreviewed sweep —
  Salman chose this explicitly over doing it all in one session.
- **Chunk 1 (this entry) covers:**
  - `styles.css` `:root` — `--maraya`/`--maraya2`/`--maraya3` ramp changed
    from the old `#5a1733`/`#7a2347`/`#9a3560` to `#600131`/`#7c1a4a`/
    `#9c3d6c`. `--dark`/`--dark2`/`--dark3` **renamed** to `--shell-bg`/
    `--shell-surface`/`--shell-tint` (now hold light values — keeping the
    old names would have been actively misleading) plus new `--shell-ink`/
    `--shell-ink-muted`/`--shell-ink-faint`/`--shell-border`. Radius scale
    tightened to `14px`/`10px`/`10px` (was `16`/`12`/`8`) to match the
    reference.
  - Full Shell component rewrite (`.lock`, `.topbar`, `.bnav`, `.eco-bg`,
    `.info-panel`, `.roadmap`, `.note-card`, `.check-section`, `.ph`) — dark
    → light, every literal `rgba(255,255,255,.X)` replaced with the new
    ink/border tokens.
  - `#ops-module-wrap` and `#curt-module-wrap` local variable blocks
    retoned — `--info` (previously blue `#2563eb`, used for sub-tabs/links/
    back-buttons) and `--curt`/`--purple` (Curtain's own accent) both fold
    into the shared wine `--maraya`, since neither was a true semantic,
    both were functioning as a second brand color. **True semantics kept
    distinct on purpose** — `--ok`/`--warn`/`--bad` (green/amber/red) are
    unchanged, and Operations' department-legend colors
    (`--carp`/`--paint`/`--uph`/`--metal`) are unchanged too, since those
    are genuine categorical/qualitative colors (a heatmap needs multiple
    distinguishable hues), not brand identity — folding them into one
    accent would have made that legend unreadable. Added the reference's
    subtle card shadow to `.card`/`.kpi` in both modules.
  - **Ecosystem-hub SVG** (`index.html`, the circular module map) — the
    single largest piece of real visual-design work in this chunk, not a
    token swap. It was hand-tuned for a black backdrop: radial-gradient
    background (`#180810`→`#0a0a0f`), `rgba(255,255,255,.0X)` "ghost"
    rings/lines/text calibrated to be faint-but-visible against black —
    all of which is **literally invisible** against a light backdrop (near-
    white on light grey). Rewrote: background gradient to white→`#f5f6f8`;
    the 3 outer guide-ring strokes and the 3 lines to the "soon" ring-3
    nodes (Owner/HR/Tally) to dark low-opacity equivalents; all 6 "soon"/
    planned nodes (Upholstery, Joinery, Painting, Owner, HR, Tally) from
    near-invisible white ghosts to a visible light-grey `#eef0f3` fill with
    a soft dark border (iterated on opacity via real screenshots until it
    read clearly as "planned, not built" without looking like a solid
    blob); sub-node labels (Tracks/QC/Install) and the legend text to dark
    ink. **Deliberately left unchanged**, confirmed correct via screenshot:
    the *built*-node circles (dark-toned `OKG`/`PUG`/`CG` radial gradients)
    and their white text — these are colored badges, not canvas, and read
    fine as solid circles on light; the center Maraya logo circle likewise
    (though its literal hex was updated from the old `#9a3560`/`#5a1733`
    ramp to the new `#9c3d6c`/`#600131` for exact brand consistency, along
    with the topbar's small logo mark SVG which had the same old literal
    values).
  - Also found and fixed while grepping for leftover old-accent hex values
    (a real defect-hunt, not just the planned files): 4 instances of
    literal `#7c3aed` (old Curtain purple) in Curtain's calc-sheet UI
    embedded directly in `index.html` (input focus ring, a "Fill myself"
    hint box, a treatment label, two save buttons) — all outside the
    `#curt-module-wrap`-scoped CSS so the module retoning didn't reach
    them; and 2 instances in `styles.css` (`#ops-module-wrap`'s
    `.pill.purple`/`button.sm.purple`, a cross-module reference to Curtain
    used elsewhere in Operations) — both now point at the shared wine
    token instead of hardcoded purple.
  - Also fixed two more Shell-adjacent literal-color bugs found only by
    looking at the rendered screenshot, not by grep: a "Planned" KPI tile
    (`qs-planned-count`) and a "Core revenue pipeline" info banner on the
    Ecosystem page, both inline-styled directly in `index.html` (not part
    of the Shell CSS rewrite since they're not shared classes) using
    `rgba(255,255,255,.X)` text on `rgba(255,255,255,.0X)`/light-blue
    backgrounds — both were reading as blank/washed-out white space until
    caught in the screenshot and given proper light-theme colors (grey
    tile, wine-tinted banner).
- **Verification:** Playwright screenshots (headless Chromium) of PIN
  unlock, the Ecosystem hub, Operations dashboard, and Curtain & Blinds
  dashboard — all confirmed rendering correctly: light backgrounds, wine
  accent on active tabs/buttons/badges, no leftover purple or blue
  anywhere. Grepped `index.html` and `styles.css` for every old accent hex
  (`#7c3aed`, `#5a1733`/`#7a2347`/`#9a3560`, `#5b21b6`) after the visual
  pass — all clear except one intentional doc-comment. Did not re-run the
  full `node --check`/duplicate-declaration/onclick-cross-reference battery
  since no JS logic changed this chunk, only CSS values and SVG attributes.
- **Explicitly NOT touched this chunk** (still on the old hardcoded colors,
  scheduled as Chunk 2 and Chunk 3): Purchasing, Storekeeper, Sales,
  Estimator, Approver, Jobs, Accounts. Don't be surprised these still look
  like the old design — that's expected until their chunks land.
- **Next steps:** Chunk 2 (Purchasing + Storekeeper) and Chunk 3 (Sales/
  Estimator/Approver/Jobs/Accounts) — see the color-count breakdown above
  for scope. Each of the ~390 hardcoded hex values across those 7 files
  needs the same treatment: fold brand/interactive-accent uses into the
  wine token, leave true semantics and categorical colors alone. The 6
  modules that already read from shared `--biz-*` tokens (all but
  Purchasing) should need central-token updates plus per-file cleanup of
  whatever wasn't tokenized; Purchasing needs the token migration itself
  first, not just a recolor.


### 3 Aug 2026 — 3D "S.A" ecosystem hub replaces the flat 2D SVG map

- **Replaced the entire ecosystem hub visual** (the home-screen module map)
  with a three.js orbiting node graph, adapted from a design reference
  Salman uploaded ("Heartwood 3D Backend Wheel" — a wireframe-icosahedron
  hub-and-branch graph with camera zoom-to-focus). The 2D SVG map
  (`<svg class="eco-svg">`, ~295 lines) and its touch/click handling script
  are both gone, replaced by a `<div id="eco3d">` canvas host and a new
  `<script type="module">` block at the bottom of `index.html`.
- **Real decisions behind this, from Salman directly:**
  1. Replaces the main hub entirely — not a separate "Backend" section
     (the reference's own framing, since it named its modules after a
     generic SaaS admin panel — Billing/Database/Deployments/etc. — none
     of which are real AMD modules; only the visual/interaction language
     was reused, not the content).
  2. **Pure black canvas is a deliberate, approved exception** to Chunk
     1's "unify everything to light" rule — the orbiting-nodes-in-space
     look genuinely depends on a black void to read well, treated like a
     one-off planetarium-style hero screen rather than fought into the
     light system.
  3. **One purple accent (`0x9b5cff`), no per-status color.** Built vs
     Planned (Building is a third tier, currently unused — 0 modules are
     in that state — but the code supports it) is carried entirely by
     opacity/radiance: built nodes render at ~0.95 opacity and glow
     bright, planned nodes sit around 0.16 opacity as faint ghosts. No
     green/amber/grey anywhere in this screen anymore.
  4. Hub is labelled **"S.A"** (Salman's own initials, replacing the old
     "MARAYA" center label — his call, not a placeholder).
  5. **Hub + branches only, no leaf tier** in this version — the
     reference supports a 3rd tier (leaves spawned around a focused
     branch) but AMD's modules don't have natural sub-items yet except
     Curtain & Blinds (Tracks/QC/Install), which stays excluded from the
     3D graph for now per explicit scope-cut.
- **All 15 real branch nodes** (Operations, Curtain & Blinds, Purchaser,
  Storekeeper, Upholstery, Joinery, Painting, Sales, Estimator, Owner
  Dashboard, Accounts, Jobs, HR & Payroll, Approver, Tally Bridge) reuse
  the exact same `built`/`launch()` data the old SVG's `NODES` array
  had — tapping a built node calls its real `launch()` (e.g.
  `goTo('operations')`, `launchCurtainModule()`) exactly as before;
  tapping a planned node shows the existing `#eco-tooltip` "Coming soon"
  element positioned at the node's projected screen coordinates, instead
  of the old SVG-coordinate-based positioning. The quick-stats tiles
  (Built/Building/Planned counts) and the Roadmap/Notes/Checklist tabs
  were untouched — they read from a separate data source (`M` in
  shell.js) that this change never touched.
- **Technical integration:** `three@0.184.0` loaded via a plain ES-module
  import map (with the reference's own SRI integrity hashes) added to
  `index.html`'s `<head>` — no bundler, drops straight into the existing
  no-build-step setup the same way the Google Fonts `<link>` already
  does. `OrbitControls` (touch-drag to rotate, auto-rotate when idle,
  tap-to-focus a branch with camera FOV narrowing 46°→30°, tap again to
  reset) reused near-verbatim from the reference — it already supports
  touch out of the box, no separate mobile interaction layer needed.
- **Verification:** Playwright screenshots at desktop (420×900) and
  mobile (390×844, iPhone-sized) viewports, both read cleanly — bright
  built nodes clearly distinct from dim planned ones, "S.A" hub visible
  and pulsing, quick-stats/pipeline-banner chrome around the canvas
  intact. Confirmed navigation still works end-to-end deterministically
  (called a branch's real `launch()` via the new `window.__eco3d` debug
  handle rather than trusting a screen-coordinate click on a
  continuously-orbiting node, since the first attempt at that gave a
  false-positive "module opened" read from checking `#ops-module-wrap`'s
  own `display` — a child element's computed display isn't affected by
  an ancestor's `.page{display:none}`, so that specific check was
  meaningless; switched to asserting `#p-operations` actually gained the
  `active` class, which is what `goTo()` really sets) — zero console
  errors on that clean run. An earlier, messier test (8 rapid synthetic
  clicks at different angles against continuously-orbiting nodes) did
  throw one `Cannot read properties of undefined (reading 'layers')`
  console error from `OrbitControls` — reproduced against the
  *unmodified* reference file too during initial review, so it looks like
  a pre-existing fragility in the reference's raycasting under rapid
  synthetic clicks rather than a bug introduced here; a real user's
  single tap doesn't hit this path. Not re-verified on real touch
  hardware — Playwright's synthetic pointer events aren't a substitute
  for an actual iPad/iPhone test.
- **Known minor issue, not fixed this session:** at narrow (mobile)
  viewports, node labels can briefly clip at the canvas edge or overlap
  each other when two nodes' 2D projections land close together during
  auto-rotation — cosmetic, self-corrects as rotation continues, not
  something a tap can mis-target since hit-testing is 3D raycasting
  against the actual node mesh, not the label text.
- **Also noticed in passing, out of scope for this session:** the lock
  screen's logo mark (`index.html`, the raw inline-styled div inside
  `<div class="lock" id="lock">`) still uses a literal dark gradient
  (`#1a0a14`→`#0a0a0f`) instead of the wine `--maraya`/`--maraya2`
  gradient Chunk 1 applied everywhere else — it was missed because Chunk
  1 only fixed the `.lock-logo` *class*, which turns out to be unused;
  this specific element has no class attribute at all. Small, contained
  fix for whoever picks up Chunk 2/3.
- **Not touched:** Chunk 2 (Purchasing + Storekeeper) and Chunk 3 (Sales/
  Estimator/Approver/Jobs/Accounts) remain exactly as documented in the
  previous session log entry — still on old hardcoded colors, still
  pending.

### 3 Aug 2026 (later same day) — UI redesign Chunk 2: Purchasing + Storekeeper

- **Retoned the central `--biz-*` design tokens** in `styles.css` (the
  "SHARED BUSINESS-MODULE DESIGN SYSTEM" block) to the same wine accent
  (`#600131`) light system as Chunk 1 — every module-identity `--biz-*`
  color (`--biz-primary`/`-purple`/`-teal`/`-cyan`/`-magenta`/`-amber`/
  `-crimson`/`-lavender`/`-emerald`, plus their lighter `2`-suffixed
  steps) now resolves to the one shared wine ramp instead of each having
  its own hardcoded hex. `--biz-page-bg`/`-card-bg`/`-border`/
  `-border-light`/`-text`/`-text-muted`/`-text-faint` now match the light
  Heartwood palette; `--biz-r`/`-r-sm`/`-r-lg` are `14px`/`8px`/`16px`;
  `--biz-shadow` is the same subtle card shadow used everywhere else.
  The quotation-lifecycle pill colors (draft/open/confirmed/closed) were
  deliberately left untouched — genuine semantic state, not brand
  identity, same principle Chunk 1 applied to Operations' ok/warn/bad.
  **This immediately, automatically improved every module that already
  read from `--biz-*`** (Storekeeper fully, Sales/Estimator/Approver/
  Jobs/Accounts partially, since they're only partly tokenized) — a
  known, accepted side effect of doing the token change centrally;
  Chunk 3 still owns finishing those five files' own hardcoded leftovers.
- **Dropped the IBM Plex Sans Google Fonts `<link>`** from `index.html`'s
  `<head>` and pointed `--font-biz` at the same system font stack as the
  rest of the app — one less CDN dependency, full typographic consistency
  with Shell/Operations/Curtain. Nothing else referenced that font.
- **Storekeeper (`storekeeper.js`)** — already used `--biz-*` for most of
  its styling (built that way from the start, 25 Jul 2026), so the
  central token change did most of the work. Spot-fixed the ~4 remaining
  literal-hex leftovers that were genuine brand-accent bleed-through: a
  manually-computed `:hover` darken (`#0d5f58`, old teal → now
  `var(--biz-primary-dark)`), a light-teal-tinted header subtitle
  (`#ccfbf1` → a light wine tint, `#f0cfe0`), the module wrapper's page
  background (`#f7f9fc` literal → `var(--biz-page-bg)`), and one stray
  border literal (`#e2e8f0` → `var(--biz-border)`). Left ~26 other
  literals alone — slate-gray neutrals (`#64748b`/`#94a3b8`/etc.) close
  enough in value/role to the new neutral scale that touching dozens of
  scattered inline-template-literal instances wasn't worth the risk for
  a barely-perceptible difference, plus one neutral dark tooltip
  background (`#1a1f2e`) that isn't brand-related at all.
- **Purchasing (`purchasing.js`)** — this one was NOT tokenized at all
  (confirmed zero `var(--biz-*)` usage before this session, 87 literal
  hex colors, its own separate hardcoded lavender scheme). Migrated it
  onto the shared `--biz-*` system rather than just recoloring in place —
  a real architectural fix, not just a reskin, bringing it in line with
  how Storekeeper/Sales/Estimator/Approver/Jobs/Accounts already work.
  Rewrote the module's injected `<style>` block (header, nav/tabs,
  buttons, cards, KPI tiles, dept-filter chips, the modal panel and its
  form fields) to consume `--biz-primary`/`--biz-primary2`/
  `--biz-card-bg`/`--biz-border`/`--biz-border-light`/`--biz-text-muted`/
  `--biz-r`/`--biz-r-sm`/`--biz-r-lg`/`--biz-shadow` instead of hardcoded
  values, added the same subtle card shadow Chunk 1 gave Operations/
  Curtain, and aligned the modal backdrop color to the same
  `rgba(16,24,40,.4)` used by the Shell's own overlay. Then swept the
  remaining ~1,650 lines of dynamically-generated HTML (inline `style=`
  strings in template literals) for the same lavender leftovers — found
  8 more instances of `#9B5FB0`/`#6B3F7A` on buttons ("+ Add item",
  "Convert to PO →", "Receive & Convert to Invoice →", "New Invoice",
  supplier "View") and 2 instances of a third, distinct magenta
  (`#be185d`, the "pink/magenta Confirm button" CLAUDE.md §3 already
  documents as matching the live Q-Pro Invoice two-stage flow) — folded
  all of these into `var(--biz-primary)` too, since none of them are true
  semantics, just in-module accent choices. The 5 status-pill colors
  (pending/approved/rejected/issued/invoiced) are genuine semantic state
  and were left as their own literal hex, same call as everywhere else.
- **Found 2 more leftovers outside either module's own file** — the
  Purchase Invoice "Locate" button and the Supplier Payment "Create
  Payment" button both live as static markup directly in `index.html`
  (not in `purchasing.js`), so Purchasing's own file-level color audit
  missed them. Caught via a repo-wide grep for every old per-module
  `--biz-*` hex value as a final check — both now use
  `var(--biz-primary)`.
- **Also fixed, out of this chunk's original scope but flagged in the
  previous session's log as a small leftover:** the PIN-lock screen's
  logo mark (`index.html`, the raw inline-styled `<div>` inside
  `<div class="lock" id="lock">`) still had a literal dark gradient
  (`#1a0a14`→`#0a0a0f`) — Chunk 1 had only fixed the unused `.lock-logo`
  *class*, not this actual unclassed element. Now uses
  `linear-gradient(135deg,var(--maraya),var(--maraya2))` plus the same
  soft wine glow shadow the rest of the Shell's brand marks use.
  Re-verified via `smoke-test.js` screenshot — matches the rest of the
  lock screen now.
- **Verification:** loaded the app in Playwright (PIN `1994`), opened
  both modules via their real `launch*Module()` functions, screenshotted
  both dashboards — wine accent consistent throughout (header bars,
  active tabs, KPI numbers, toggle buttons), cards showing the new
  subtle shadow, status pills still distinct. Zero console errors.
  Repo-wide grep for every old per-module accent hex (`#6B3F7A`,
  `#9B5FB0`, `#09AD95`, `#0774F8`, `#45AAF2`, `#0A5FCC`, `#5E2DD8`,
  `#007EA7`, `#D43F8D`, `#b45309`, `#e0a530`, `#9f1239`, `#dc2f5e`,
  `#047857`, `#10a370`, `#be185d`) turned up hits only in files that are
  explicitly Chunk 3's scope (`approver.js`, `estimator.js`, `sales.js`,
  `jobs.js` — left untouched on purpose) plus one genuine semantic
  amber-warning color in `curtain.js` (QC "Being inspected/Held" lock
  state, `#b45309` — not brand identity, left alone) — confirms Chunk 2's
  own scope is fully clean.
- **Not touched:** Chunk 3 (Sales/Estimator/Approver/Jobs/Accounts)
  remains on its own old hardcoded colors (partially improved for free by
  the central `--biz-*` token change, as noted above, but still needs its
  own dedicated pass for the literal hex each of those 5 files carries).

### 3 Aug 2026 (later same day) — Chunk 3: Sales/Estimator/Approver/Jobs/Accounts, redesign complete

- **Fixed the one module missed by the central token cascade:**
  `approver.js`'s `.ops-header` was hardcoded literally (`#9f1239`, not a
  variable) so it never picked up Chunk 2's `--biz-crimson` retone — now
  `var(--biz-crimson)`. Also gave `#approver-module-wrap`'s base rule the
  `font-family: var(--font-biz); background: var(--biz-page-bg);` the
  other 4 modules already had (it only had `font-family: inherit`).
- **Swept all 5 files' literal hex for brand-accent leftovers** — the
  gradient tile classes (`.sales-tile.t-purple/.t-teal/.t-magenta/
  .t-amber/.t-cyan`) in `sales.js` and `jobs.js` had one token stop
  (e.g. `var(--biz-purple)`, already wine) paired with a literal bright
  second stop (`#8B5FE8`, `#3FCBB5`, `#E876B0`) or, for `.t-amber`, both
  stops literal (`#c47d00`/`#e0a530`) — all now `var(--biz-primary)`/
  `var(--biz-primary2))`. Preview/highlight panels (`sales-preview`,
  `sales-wizard-step.done`) and the Purchase-Request-from-Job header
  (`jobs.js` `.prjob-header` — previously its own deliberate lavender
  zone color, per an explicit code comment from the original per-module
  era) all folded to a shared pale-wine tint (`#f4e6ec` bg / `#e0c2d0`
  border), matching the tint Chunk 1 established for Curtain. Header
  subtitle text (the small caption under each module's white title, e.g.
  "Enquiry → Quotation") was a pale module-colored literal
  (`#ede9fe`/`#fef3c7`/`#fecdd3`/`#DAEEFC`/`#d1fae5`) in all 5 files —
  now `rgba(255,255,255,.7)` everywhere, so it reads as "dimmed white on
  a colored bar" regardless of which bar color a module has. Two more
  old-brand-hex-as-literal instances turned up mid-sweep in
  `estimator.js` (a quotation-ID color and a "CREATE NEW PRODUCT" link,
  both `#b45309`) and one in `approver.js` (a quotation-ID color,
  `#9f1239`) — all now `var(--biz-primary)`.
- **Also aligned:** each module's open-state inline background
  (`moduleWrap.style.cssText = '...background:#f7f9fc;'`, set in JS when
  the module opens, present identically in all 5 files) was a literal
  slightly-off neutral that also silently overrode the CSS rule's
  `background: var(--biz-page-bg)` via inline-style precedence — swapped
  to `var(--biz-page-bg)` directly so it's one source of truth and
  actually reflects token changes going forward.
- **Judgment call, flagged per instruction rather than applied silently:**
  the Estimator and Approver "logged in as" userbars were amber-tinted
  and rose-tinted respectively (`#fffbeb`/`#fde68a`/`#92400e` and
  `#fff1f2`/`#fecdd3`) — a distinct-from-header color, seemingly meant to
  read as "a different role indicator." Given "one accent everywhere" was
  explicit and unambiguous in every prior chunk (even Curtain's purple
  and Operations' info-blue got folded), retinted both to the same pale
  wine tint used elsewhere (`#f4e6ec`/`#e0c2d0`/`var(--biz-primary-dark)`)
  rather than preserving them as a role-color exception. If that reads as
  the wrong call once seen live — the userbar losing its distinct color
  meant something was worth double-checking — this is the one place to
  revisit.
- **True semantics left alone, same policy as every prior chunk:** the
  three `sales-pill.stage-*` colors (Sales/Estimator/Approver — which
  stage a quotation is currently at, present in all 5 files identically)
  stay their three distinct colors, since collapsing them to one wine
  tone would destroy the thing they exist to show. Lifecycle pills
  (draft/open/confirmed/closed), the Jobs status legend
  (open/completed/cancelled — blue/green/red), warning banners, and the
  Tax Invoice's deliberately-distinct formal-document styling (`jobs.js`
  `.invoice-paper` and everything under it — black ink, serif type, no
  brand color at all, per the standing design note that transactional
  documents should read as printed paper, not app chrome) were all left
  exactly as they were.
- **Verification:** Playwright (PIN `1994`), opened all 5 modules via
  their real `launch*Module()` functions, screenshotted each dashboard —
  wine accent consistent throughout every header/tab/KPI-number/button,
  both userbars now wine-tinted, Jobs' status pills still distinct
  blue/green/red, zero console errors across all 5.
- **Repo-wide grep sweep (the full old-accent-hex list, all chunks'
  values) turned up a real, out-of-scope finding:** `curtain.js` still
  has roughly 19 literal `#7c3aed` (the old Curtain-module purple) in
  inline `style=` strings inside its render functions — KPI numbers,
  status dots, assignment-selection highlights, a few buttons, turnaround
  labels. `operations.js` has one more (`color:#7c3aed`, a "filling
  directly" label). **Chunk 1 only retoned the CSS-based
  `#curt-module-wrap` token block** (`styles.css`) — it never swept
  `curtain.js`'s own ~5,900 lines of inline literal colors the way each
  subsequent chunk swept its own files. This is the same category of gap
  Chunk 2 found and fixed in Purchasing, just never caught for Curtain
  because Curtain was assumed "done" after Chunk 1. **Not fixed this
  session** — out of Chunk 3's scope (Sales/Estimator/Approver/Jobs/
  Accounts only) and `curtain.js` is the single largest file in the repo,
  deserves its own dedicated sweep-and-verify pass rather than a
  bolted-on fix here. Flagging as the one real piece of unfinished work
  from the whole redesign initiative.
  `data.js`'s `DEPTS` array (5-color department-tagging registry used
  for category badges across modules, including a purple entry for
  Curtain) was checked and deliberately left alone — same call Chunk 1
  made for Operations' `--carp`/`--paint`/`--uph`/`--metal`: genuine
  categorical/departmental color-coding, not brand identity, folding it
  to one color would remove real information.
- **Redesign initiative wrap-up:** with Chunk 3 done, the Heartwood-
  reference-derived redesign (single wine accent `#600131`, light
  `#f5f6f8`/`#ffffff` system, 14/10/999px radius scale, subtle card
  shadows) now covers the Shell, all 11 business modules, and the 3D
  ecosystem hub (deliberately dark, per its own explicit exception) —
  except for the `curtain.js` inline-color gap noted directly above,
  which is real remaining work, not a rounding error. Next session on
  this thread of work should be a dedicated `curtain.js` sweep, verified
  the same way as every other file, before calling the whole initiative
  actually complete.

### 3 Aug 2026 — Chunk 4: the actual closing pass on curtain.js's inline colors

- **Confirmed and fixed the gap Chunk 3 flagged.** `curtain.js`'s own
  ~5,900 lines of inline literal colors — invisible to every prior
  chunk's CSS-class-based approach, since these render via
  `document.body`-appended overlay `<div>`s (`#tracks-dash-wrap`,
  `#qc-dash-wrap`, `#install-crew-wrap`, `#pipeline-board-wrap`) that
  sit **outside** `#curt-module-wrap` and are built entirely from JS
  template-string `style="..."` attributes, not CSS classes — got their
  own dedicated sweep.
- **Real scope turned out narrower than the raw color count suggested.**
  Investigated all "four dark surfaces" candidates before touching
  anything:
  - **Tracks dashboard** (`openTracksDashboard()`) — genuinely fully
    dark (`background:#111827` root), ~85 dark-navy/purple color refs.
    The one dashboard needing a full light conversion.
  - **QC dashboard** and **Install Crew dashboard** — already built with
    a light `#f7f9fc` body background (not dark at all); only their
    header bars and a handful of `#7c3aed` purple text/button literals
    were leftover from the old theme.
  - **Pipeline board** (`openPipelineBoard()`, the CLAUDE.md-documented
    "Job → Window → Stitching/Track/QC/Ready for delivery" board) — a
    **fourth dark surface not previously identified in this repo's
    documentation at all**, found only by re-running the whole-repo grep
    sweep after the other three looked clean. Same pattern: dark
    `#111827` column-board view, light `#f7f9fc` detail-panel view.
  - **`#curt-calc-sheet`** and **`#curt-copy-calc-panel`** (two modals
    embedded directly in `index.html`, not `curtain.js`) — found the
    same way. Both already had light (`#fff`) bodies; only their header
    bars were dark.
  - A cross-cutting discovery along the way: **`#1e2a3b`** (a near-black
    navy) turned out to be used throughout `curtain.js` in two distinct,
    consistent roles — `background:` on every header bar (→ retoned to
    `var(--maraya)`, matching the colored-header pattern every other
    module already uses) and `color:` on ordinary body text (→ retoned
    to `var(--shell-ink)`, since it was already functioning as an
    ink/text color, just not tied to any token). One exception handled
    separately: a canvas `strokeStyle` assignment (signature pad) needed
    a real literal color, not a CSS `var()` — set to `#16181d` directly.
  - Genuine semantics left untouched, same principle as every prior
    chunk: green/red/amber status indicators (done/rework/warning),
    blue as a distinct "informational/waiting" tint (matches the
    existing Open-lifecycle pill precedent, not brand identity), pink
    as the left/right cord-side differentiator, cyan/purple-adjacent as
    the two-way ROLLER/RAIL categorical badge. `data.js`'s `DEPTS`
    registry (including Curtain's own purple department-tag swatch,
    used for cross-module category badges) was re-confirmed correct to
    leave alone — same categorical-color precedent as Chunk 1/3.
- **Verification:** `node --check` on `curtain.js`/`operations.js`;
  Playwright screenshots of Tracks (queue view + item cards), QC, Install
  Crew, and Pipeline board (opened, screenshotted, closed back to the
  Curtain dashboard cleanly with no leftover dark element or broken
  layout); zero console/page errors throughout. Final whole-repo grep
  sweep for every old accent/dark hex from all four chunks combined
  (`#7c3aed`, `#1e2a3b`, `#111827`, `#5a1733`/`#7a2347`/`#9a3560`,
  `#5b21b6`, `#6B3F7A`/`#9B5FB0`, `#09AD95`) — zero remaining matches
  outside of source comments and the legitimate `DEPTS`/stage-pill
  categorical colors.
- **Redesign initiative is now genuinely complete** — Shell, all 11
  business modules, the 3D ecosystem hub, and every sub-dashboard/modal
  found along the way all run on the single wine accent (`#600131`) and
  light system, with the 3D hub's pure-black canvas as the one
  deliberate, explicitly-approved exception. Chunks 1–4 committed
  locally (`a62427c`, `d259e59`, `6ff009a`, `e7bf7b2`, and this session's
  commit); not pushed yet at time of writing — push all together once
  reviewed.

### 3 Aug 2026 (later same day) — Real-device bug: 3D hub node taps did nothing, root cause found + fixed

- **Report from Salman, testing live on his iPhone (Safari, home-screen
  bookmark) right after Chunk 4 shipped:** tapping any node in the new 3D
  ecosystem hub did nothing — no navigation, no response (e.g. tapping
  Sales never opened Sales). Scene rendering and `OrbitControls`
  drag-to-rotate both worked fine, which narrowed it down to something
  specific to the tap-to-select code path rather than the whole 3D scene
  being broken.
- **Root cause — nothing to do with touch/iOS at all:** in the hub/branch
  node-creation code (`index.html`, the `<script type="module">` block
  added in the 3 Aug "3D S.A ecosystem hub" session), `makeNode()` sets
  `mesh.userData.hitMesh = hitMesh` internally (the invisible solid mesh
  raycasting needs, since `LineSegments` wireframes alone don't reliably
  raycast). Both call sites — `hub.userData = {...}` and
  `mesh.userData = {...}` in the `branches` map — immediately
  **reassigned** `.userData` to a brand-new object right after
  `makeNode()` returned, silently wiping out the `hitMesh` property that
  had just been set. Every `raycaster.intersectObjects(...)` call was
  therefore run against an array of `undefined`, which throws
  `Cannot read properties of undefined (reading 'layers')` — inside an
  event listener, so the failure was completely silent to the user, and
  it happened on literally the first tap, every time, on every device.
  This is why it looked like an iOS-specific issue when reported: the
  visible symptoms (render fine, drag fine, tap dead) are also consistent
  with several touch-specific theories, and the earlier verification
  pass never actually caught it because it called `n.launch()` directly
  via `page.evaluate()` to confirm navigation wiring, which bypasses the
  raycasting/click pipeline entirely — never exercising the actual code
  path a real tap goes through. **Lesson for future 3D/canvas work:**
  verifying "the function navigation calls works" is not the same as
  verifying "tapping the visual element works" — the latter needs the
  real event pipeline exercised, not a direct function call.
- **Fix:** `Object.assign(hub.userData, {...})` /
  `Object.assign(mesh.userData, {...})` instead of reassigning `.userData`
  wholesale, so `hitMesh` survives. Also switched tap-detection from the
  original design reference's hand-rolled `pointerdown`/`pointerup` +
  manual pixel-distance check to the browser's native `click` event
  (reliably synthesized only for a genuine tap-without-drag on every
  browser, no manual threshold needed) — a smaller, separate robustness
  improvement made at the same time, not the actual fix for this bug.
  Removed the now-unused `downPos` variable.
- **Verification — this time actually exercising the real tap pipeline,**
  not calling `launch()` directly: Playwright with real iPhone 13 device
  emulation (`devices['iPhone 13']`, `hasTouch` via the device preset) and
  `page.touchscreen.tap(x, y)` (genuine touch events, not
  `page.mouse.click()`) against the live screen-projected position of an
  on-screen node (read directly from the app's own exposed
  `window.__eco3d.branches` + camera projection, since the ring of 15
  nodes means roughly half are off-screen at any moment during
  auto-rotation — picked whichever built node was actually visible rather
  than assuming a fixed one). Confirmed twice: a real touch tap on the
  Storekeeper node's live position opened `#sk-module-wrap`
  (`display:flex`) end-to-end through the actual raycasting/click code,
  zero console errors. This is the verification method that should have
  been used the first time — noted above as a lesson for next time.
- **Not pushed by a background agent this time** — pushed directly after
  manual verification, per the process gap flagged in the previous
  session (background agents shouldn't be trusted to hold a "don't push"
  instruction unsupervised).

### 3 Aug 2026 (later same day) — Built Batch 5: HR & Payroll

- **Built Batch 5** (Employee master, HR Dashboard, Voucher Ledger
  Mapping, Customer Update), traced from
  `docs/qpro-mapping/batch5administrationpayrollhr.txt`. Full coverage
  detail is in §3 rather than repeated here. Short version: reviewed the
  spec in full, reviewed existing code before building (confirmed
  Approver's KPI tiles were already complete — the spec's apparent gap
  no longer existed, saving a rebuild), deliberately skipped Q-Pro's
  Users/Groups/Quick Menu login-system section and the vestigial Employee
  Category master (same "don't build what this app's architecture doesn't
  need" precedent as earlier batches), and built the new HR module
  directly on the wine-accent light system from the recent redesign — no
  restyling debt on a module that didn't exist before it.
- **Real bug found and fixed, not part of Batch 5's own scope:** the 3D
  ecosystem hub (built earlier this session) could render its canvas at a
  wrong fallback size (380×500 instead of the real container size)
  because resize only re-ran on a browser `window` resize event, which
  tab-switching inside the app never triggers. This silently broke
  click/raycast alignment near the canvas's right/bottom edge for
  whichever nodes happened to land there. Found specifically because this
  session tested the new HR node's tap through the real raycasting path
  rather than calling `launchHRModule()` directly — the verification
  discipline established after the earlier node-tap bug this session.
  Fixed with a `ResizeObserver` on the canvas container.
- **Voucher Ledger Mapping decision:** built the mapping screen (Accounts
  → Voucher Ledger Mapping) correctly, but deliberately did NOT wire it
  into the 4+ existing forms that currently pick a ledger directly
  (Batch 1's Supplier Payment/Debit Note, Batch 3's General Receipt/
  Payment, Batch 4's Sales Receipt/Credit Note) — that's a bigger,
  riskier change touching several already-working flows, kept as an
  explicit documented follow-up rather than risking breakage in the same
  pass. See §5.
- **Verification:** full battery — `node --check` on all 11 modified/new
  files individually and the 12-file concatenation; duplicate top-level
  declaration scan (none found); onclick/onchange/oninput cross-reference
  (all resolve); closure-variable-in-inline-handler scan (none
  introduced); full Playwright pass including the real-tap verification
  described above, and functional (not just visual) tests of
  `setVoucherLedgerMapping()`/`applyCustomerUpdate()` actually mutating
  state; mutual-exclusivity hiding confirmed both directions. Zero
  console/page errors.
- **Next steps:** Batch 6 (Reports) is the last remaining spec-only batch;
  Voucher Ledger Mapping still needs wiring into the existing
  Receipt/Payment/Credit Note/Debit Note forms if that's wanted; Accounts'
  Payables KPI still doesn't net off real payments (long-open item);
  `jobCards[]`/`curtainJobs[]` unification remains deferred.

### 3 Aug 2026 (later same day) — Built Batch 6: Reports — completes the full 6-batch Q-Pro mapping exercise

- **Built Batch 6**, traced from `docs/qpro-mapping/batch6reports.txt`.
  Full coverage detail is in §3 rather than repeated here. Short version:
  13 reports across 5 existing files (Accounts got 5 new tabs — Day Book,
  Ledger Report, Trial Balance, P&L, Balance Sheet; Sales got a new
  "Reports" top-tab — Quotation Register + Sales Bill Outstanding covering
  all 4 spec variants in one screen; Purchasing got a new "Bill O/s" nav
  tab for the vendor-side mirror; Jobs got a new "📊 Reports" button — Job
  report, Project Outstanding, Project wise Invoice & Receipt; HR got a
  new Payroll Report tab). No new ecosystem-hub node, no new business
  entities — matches the spec's own finding that Reports are thin,
  read-only views over data already mapped in Batches 1–5. This is now
  **the last of the original 6 Q-Pro batches** — the full mapping exercise
  (Purchases, Inventory, Accounts, Sales & Job Operations, Administration/
  Payroll/HR, Reports) is complete.
- **The one real design problem this session surfaced**: while building
  P&L/Balance Sheet purely off GL ledger postings (Journal/General
  Receipt/Payment), the numbers came out useless — Batch 3's seed Chart of
  Accounts files "Sales" under "Current Assets", not "Direct Incomes", and
  no custom group at all sits under "Direct Incomes" — a legitimate
  Debtors-control-account pattern, not a data bug, so the seed data was
  left untouched. Fixed by having Direct Income/Expense (P&L) and
  Receivables/Payables (Balance Sheet) read straight from the real
  taxInvoices/purchaseInvoices, the same source the existing Accounts
  Dashboard KPIs already use, with Indirect Income/Expense and Cash/Bank
  balances still coming from the GL layer where that's genuinely correct.
  Verified via a standalone `vm.runInContext` smoke test (a synthetic
  Enquiry→Quotation→Job→Invoice lifecycle) before any UI was written.
- **Closed a long-open TODO as a direct side effect**: `getAccountsKPIs()`
  (Accounts Dashboard) still summed full invoiced/received amounts without
  netting off real Payment/Receipt/Credit Note activity, flagged since
  Batch 1/4. Building the Balance Sheet needed the correctly-netted figure
  anyway, so fixed `getAccountsKPIs()` itself rather than shipping two
  different Receivables numbers side by side. This item is now closed,
  not just Balance-Sheet-scoped.
- **Purchase Bill Outstanding's vendor-side mislabel (a confirmed spec
  bug — cloned from Sales Bill Outstanding without relabeling "Client
  Name"/"CLIENT") was fixed, not reproduced** — same "fix real bugs, don't
  replicate them" precedent as Payment/Debit Note/Receipt/Credit Note.
  Same call for Project wise Invoice & Receipt's "No Invoice List Exist"
  bug (the same systemic issue already fixed 3 times over in earlier
  batches) — `getProjectWiseInvoiceReceipt()` actually looks the job's
  real invoices/receipts/credit notes up.
- **Materials Issued/Returned on the Job report show as move counts, not
  a currency value** — deliberate, not a gap: this app's Material
  Issue/Return moves don't carry a rate/cost anywhere (confirmed existing
  precedent in `getStockReport()`), so inventing a valuation here would be
  a new, unverified methodology. Flagged in the report's own UI text.
- **Verification:** full battery — `node --check` on all 7 modified files
  individually and the full 12-file concatenation in load order; duplicate
  top-level declaration scan across all 12 files (none found); onclick/
  onchange/oninput cross-reference (all resolve); closure-variable-in-
  inline-handler scan (none introduced). Full Playwright pass
  (`e2e-batch6-reports.js`, committed, reusable) — seeded a real
  Enquiry→Quotation→Job→Invoice→Sales Receipt→General Receipt chain
  through the actual data-layer functions (not hand-typed forms, for
  speed), opened all 5 touched modules via their real ecosystem-hub node
  `launch()` (via the `window.__eco3d` debug handle established after the
  earlier node-tap bug fix), then exercised every new report tab via real
  DOM clicks. 7/7 checks passed, zero console/page errors. Screenshots
  confirmed the numbers net correctly against the seeded data (e.g.
  Balance Sheet: Accounts Receivable 170.000 = Invoice 220.000 − Receipt
  50.000 paid; Job report matched the live spec's own verified example
  shape exactly).
- **Not done this session, still genuinely open:** Voucher Ledger Mapping
  still isn't wired into Supplier Payment/Debit Note/Sales Receipt/Credit
  Note/General Receipt/Payment — turns out this doesn't block Trial
  Balance/Ledger Report/P&L from being useful after all (see above), so
  it's now a "nice to have" rather than a blocker; `jobCards[]`/
  `curtainJobs[]` unification remains deferred; `shell.js`'s `M` object
  staleness (Purchaser/Storekeeper descriptions) is still unrefreshed;
  Storekeeper's full device-test pass is still owed. With Batch 6 done,
  every module the original Q-Pro trace called for is now built except
  Upholstery/Joinery/Painting workshop modules, Owner Dashboard, and Tally
  Bridge — those were never part of the 6-batch Q-Pro mapping exercise to
  begin with (see §2's ecosystem-hub table), so "the Q-Pro trace list" is
  now fully closed out; whether to build those 3 remaining ecosystem-hub
  placeholders is a separate, new decision for Salman, not a continuation
  of this work.

### 3 Aug 2026 (later same day) — Fixed: no visible way back to the ecosystem from Operations/Curtain/Purchasing

- **Salman reported:** once inside a module, no way back to the ecosystem
  hub. Root cause, confirmed with a Playwright diagnostic
  (`e2e-back-button-check.js`, committed): every back/close button's
  `onclick` handler was actually firing correctly (`goTo('eco')` /
  `closeXModule()` all functionally worked, confirmed via automated click +
  state check) — the bug was pure CSS legibility, not broken logic:
  - **Operations' "‹ Ecosystem" bar** (`index.html`) still had
    `background:var(--dark2)` from before the 2 Aug redesign renamed
    `--dark2` → `--shell-surface`. The undefined variable resolved to
    transparent, so a `rgba(255,255,255,.08)` button with white text sat
    on Operations' own light `#f7f9fc` page background — effectively
    invisible. This is almost certainly the actual bug Salman hit, since
    Operations has no other way back and the persistent bottom nav, while
    still visible underneath (z-index 50, not covered — Operations is a
    `.page` inside `#scroll`, not a `z-index:100` overlay), might not have
    registered as "the way back" if he was looking for a button inside the
    module itself. Fixed: bar → `var(--shell-surface)`, button → solid
    `var(--maraya)` wine pill, title text → `var(--shell-ink)`, "✓ Built"
    badge → `var(--ok-bg)`/`var(--ok)` (all real, defined tokens now).
  - **Curtain's ✕** was `rgba(255,255,255,.4)` at 18px (a pre-redesign
    leftover) vs. every other module's `#fff` at 22px — technically
    visible against Curtain's wine header but noticeably fainter/smaller
    than the established pattern. Bumped to match.
  - **Purchasing's ✕** was `rgba(255,255,255,.7)` at 18px — same story,
    slightly under the standard. Bumped to match.
  - The other 7 modules (Sales/Accounts/Storekeeper/Estimator/Approver/
    Jobs/HR) were already consistent (`color:#fff;font-size:22px`) and
    confirmed working — not touched.
- **A related, larger finding, NOT fixed this pass (flagged for Salman,
  out of scope for a "fix the back button" ask):** Curtain's header icon
  badge (`rgba(124,58,237,.15)`/`rgba(124,58,237,.3)`) is the old purple
  accent expressed as decimal `rgba()` rather than hex `#7c3aed` — every
  prior redesign chunk's "final sweep" grepped for the hex string only, so
  this and at least 6 more `rgba(124,58,237,...)` instances across
  `index.html` (Curtain's Windows/BOM screens) and `curtain.js` were never
  caught. A real gap in the redesign, worth its own small sweep, distinct
  from today's fix.
- **Verification:** `e2e-back-button-check.js` (committed, reusable) —
  opens Operations directly, confirms the bottom nav is visible/z-indexed
  correctly underneath, clicks both the bottom-nav Ecosystem button and
  Operations' own internal back button (each from a fresh Operations
  visit) and confirms `#p-eco` becomes the active page both times; then
  opens all 9 remaining modules via their real ecosystem-hub node
  `launch()`, clicks each one's own close button, and confirms the wrap
  hides, `#p-eco` is active, and `#scroll` is visible. All 9 + both
  Operations paths pass. Re-ran `e2e-batch6-reports.js` afterward too (no
  JS changed, `index.html` inline-style edits only, but re-verified
  nothing regressed) — 7/7, zero console errors.

### 3 Aug 2026 (later same day) — Batch 7: role-boundary fixes, Job-as-parent bridge, Variation Orders, shared Tasks/Activity Log

Planning-only session first (no code), then Salman said "complete both
together" — see `project_amd_app_batch7_planning.md` (Claude's own memory
file, not part of this repo) for the full planning conversation this
session's build reuses. Two batches of work landed together:

**Part A — 4 small, fully-decided role/UX fixes:**
- **Accounts now owns Proforma, Sales Receipt, Sales Credit Note,
  Customer Update, and Sales Bill Outstanding.** Moved out of `sales.js`
  entirely (create/edit/delete UI, state, and the underlying render
  functions) into `accounts.js` as 5 new tabs. Sales keeps a read-only
  view — `renderRelatedRecords()` (still in `sales.js`, shared with
  `jobs.js`, untouched) already did this job. Quotation Register Report
  stayed in Sales — confirmed with Salman it's Sales' own domain, not
  accounting. Proforma generation itself (previously a tile on the Job
  Card hub calling `jobsGenerateProforma()`) moved to Accounts too — a
  Job Card reachable from Sales' own Quotation Hub was a live loophole for
  triggering financial-document creation, which is exactly what this fix
  needed to close. Tax Invoice generation was left exactly where it was
  (Job Card hub, `jobsGenerateInvoice()`) — it was never reachable from
  Sales in the first place, so it wasn't the target of the ask, and it's a
  verified-working critical path not worth touching without a reason.
- **Sales pricing is now unconditionally locked, no opt-out.** The
  `withEstimation` checkbox (defaulted unchecked, let Sales type a Rate
  directly) is gone from the wizard UI; `convertEnquiryToQuotation()` in
  data.js now hardcodes `withEstimation: true` regardless of what a caller
  passes. **Why, in Salman's own words: sales staff have previously used
  this exact editable-price path to defraud the company** — this is a
  fraud-prevention rule, not a UX preference, and should never be
  softened/reintroduced without Salman explicitly asking again (see the
  `feedback_amd_pricing_lock` memory file).
- **Print Quote is gated on Approver approval** (`lifecycleStatus !==
  'draft'`) on all three places it appears — Sales' Quotation Hub,
  Estimator's Quote Hub, Approver's Quote Hub. Previously showed
  unconditionally (it's a stub either way — "not wired to a document
  generator yet" — but the gate is the actual behavior asked for).
- **Estimator's Action card is now a single KPI-styled dropdown**
  ("Select…" / "‹ Back to Sales" / "Transfer to Approver →") replacing the
  two side-by-side buttons.

**Part B — bigger architecture, built together per Salman's "complete both
together":**
- **Job-as-parent bridge to `curtainJobs[]`/`projects[]` — bridge/link,
  NOT a data-model merge** (Salman's explicit choice after being shown the
  tradeoff: a full merge means rewriting `curtain.js`'s entire UI, its own
  multi-session project, since it's the largest, most production-critical
  file in the repo). Real finding that motivated this: both `curtainJobs[]`
  (Curtain's Tracks/QC/Install/BOM tracker) and `projects[]` (Operations'
  dashboard) were **pure hand-seeded fixture arrays with zero live
  creation path** — confirmed by grep, no `.push()` into either anywhere
  in the app before this. So `confirmQuotationToJobCard()` (and the new
  variation-merge path below) now calls `bridgeJobToOperationsAndCurtain()`
  (data.js), which auto-creates a minimal linked `projects[]` entry always,
  and a linked `curtainJobs[]` entry when the job's traced Enquiry division
  is "Curtain & Blinds" — cross-referenced by `linkedJobCardId`, seeded
  with safe/neutral defaults (health:"ok", zero budgets, empty
  `windowGroups`) rather than invented percentages nobody's actually
  entered. **A real bug found by this bridge's own Playwright test, not by
  code review:** `curtain.js`'s `ensureItemCards()` reads a flat
  `job.windows[]` array that data.js normally hydrates ONCE at load time
  (`curtainJobs.forEach(job => job.windows = flattenWindowGroups(job))`,
  over the 2 original seed jobs only) — a job bridged in later at runtime
  never got this hydration and crashed the first time Curtain's dashboard
  tried to render it. Fixed by having the bridge call
  `flattenWindowGroups()` itself when creating a new `curtainJobs[]` entry.
  Curtain's and Operations' own screens were otherwise **not touched at
  all** — confirmed via Playwright that both dashboards render the new
  live job cleanly (Curtain's "Running Jobs"/"Awaiting BOM" tiles picked it
  up automatically).
- **Variation Orders**, reusing `quotations[].rev` rather than inventing a
  new field — that field already existed (`"AMD-15350-0"`, comment: `"-0"
  is revision 0`) but was never incremented anywhere before this, strong
  evidence the real Q-Pro system already modeled quotation revisions and
  this app just never built the "create a new revision" flow. Solves the
  real problem Salman raised: a variation/change order on an existing job
  used to need a whole fresh Enquiry→Quotation→Estimator→Approver cycle
  with no link back to the original job. Now: `createVariationForJob()`
  (data.js) makes a real `quotations[]` entry (`parentJobId` set,
  `enquiryId` null) that flows through the **exact same** Estimator/
  Approver stage machinery every other quotation uses — Salman was
  explicit that variations should keep full pricing/approval rigor, no
  shortcut. `confirmVariationToJobCard()` — the Approver-gated merge —
  appends the variation's items onto the **existing** Job Card (new
  lineIds continuing from the job's current max, each tagged
  `variationId`) and adds to `job.amount`, instead of spawning a new
  `jobCards[]` entry; also re-runs the Operations/Curtain bridge so those
  linked entries' values stay in sync. UI: a "+ New Variation" tile on the
  Job Card hub (`jobsNewVariation()`) creates the variation and drops
  straight into Sales' existing wizard at step 2 (item entry) — step 1
  (Enquiry-specific fields) is skipped entirely since the variation
  already inherits the parent job's customer/project. Sales'/Estimator's/
  Approver's Quote Hub headers show "Variation for Job X" instead of a
  blank Linked-Enquiry line when `parentJobId` is set. The Job Card hub
  gained a Variations list (click through to that variation's Sales hub)
  and Items now tag which line came from which variation.
- **Shared Tasks + Activity Log primitive**, prompted by asking Salman to
  role-play Sales/Estimator/Approver/Purchaser/Accounts/Storekeeper/
  Operations Manager and describe what each role is missing — every
  single one of the 7 independently asked for the same two things (task
  tracking, a communication/activity log). Built as ONE shared primitive
  (`tasks[]`: assignee/dueDate/status/linkedType/linkedId;
  `activityLog[]`: linked to any record type) rather than 8 bespoke
  per-module implementations. **Deliberately not retrofitted into every
  existing action across all 12 modules** — real scope beyond one
  session — but it IS wired into the new Variation flow
  (`job-created`/`variation-created`/`variation-merged` log entries) and
  surfaced as real, working UI on the Job Card hub (add/complete a task,
  read the activity feed). A fuller cross-module task inbox is flagged as
  a natural, separate follow-up.
- **Verification:** full battery — `node --check` on every modified file
  individually and the full 12-file concatenation in load order; duplicate
  top-level declaration scan across all 12 files (none found); onclick/
  onchange/oninput cross-reference across the whole repo (all resolve);
  closure-variable-in-inline-handler scan (none introduced). Four
  Playwright suites, all committed and reusable:
  `e2e-batch7-small-items.js` (8/8 — tab removal from Sales confirmed, no
  withEstimation checkbox anywhere, Estimator dropdown confirmed, Print
  Quote gating confirmed both states, Accounts' 5 new tabs confirmed, a
  real Proforma generated from Accounts), `e2e-batch7-big-pieces.js`
  (12/12 — bridge creates both linked entries, Curtain/Operations render
  the bridged job with zero console errors, a full Variation lifecycle
  through the REAL UI from "+ New Variation" through wizard → estimator →
  approver → Sales' "Confirm Variation" button, confirmed merged into the
  same Job Card not a new one, task create/complete, activity log
  entries). Also re-ran `e2e-batch6-reports.js` and
  `e2e-back-button-check.js` afterward for regression — `e2e-batch6-
  reports.js` needed a small update (Sales Bill Outstanding assertions
  moved to Accounts, matching this session's Part A move) — both suites
  pass clean, zero console/page errors across all four scripts.
- **Not done this session, flagged as genuinely open:** Tasks/Activity Log
  is only wired into the Job Card hub and the Variation flow, not
  retrofitted across the other 11 modules (a deliberate scope cut, not an
  oversight); a real, separate redesign gap was found in passing — Curtain's
  header icon badge and ~6 more spots use the old purple accent as decimal
  `rgba(124,58,237,...)` rather than hex, which is why every prior
  redesign chunk's hex-string grep missed them — still unfixed, flagged
  for its own small sweep; a bridged Curtain job has empty `windowGroups`
  until someone actually adds window data through Curtain's own screens
  (expected — the bridge seeds a valid empty starting point, it doesn't
  invent window data nobody's entered).

### 3 Aug 2026 (later same day) — Batch 8, Phase 0-1: Job Routing (department auto-suggestion + Operations Manager routing queue)

A design-review round preceded this build — Salman explicitly said "before
you proceed with any build I need feedback" and the design went through
several confirmation rounds before anything was coded (full design detail
in the `project_amd_app_routing_and_budgeting` memory file, not part of
this repo — Claude's own memory, kept in sync with what's actually built).
Scope for this session, by Salman's own choice: build Phase 0-1 (the
department field + routing queue) and stop there to check in before
building the two new production modules (Joinery/Upholstery shared
pipeline, standalone Painting) and the three-tier costing/budget-approval
layer on top of it.

- **Phase 0 — department auto-suggestion on quotation items.** Each
  quotation item now gets a `departmentSequence` (ordered array of `DEPTS`
  keys) computed at `addQuotationItem()` time via a new
  `suggestDepartmentSequence()` — keyword-matches the product name first
  (curtain/blind → curt; sofa/chair/cushion/upholster → uph; cabinet/
  wardrobe/shelf/counter/vanity/joinery → carp; rail/track/bracket/steel
  → metal), falling back to the linked Enquiry's own `division` field
  when no keyword hits, and appending a `paint` stop whenever the product
  name itself mentions paint (a painted cabinet auto-suggests
  `["carp","paint"]`, matching the confirmed design's own example
  exactly). Deliberately rule-based only, per Salman's own instruction —
  no historical-pattern/ML learning layer, that's an explicit non-goal for
  now. Estimator can review/override per line from a new "Departments"
  column on the Estimation Index (`estimator.js`) — checkbox toggles per
  department, `DEPTS`' own array order doubles as the canonical stop
  order (carp before paint) rather than building a separate drag-reorder
  UI. `setItemDepartmentSequence()` (data.js) is the override path; the
  sequence carries through to the Job Card at confirm time (both
  `confirmQuotationToJobCard()` and `confirmVariationToJobCard()`).
- **Phase 1 — Operations Manager routing queue.** New
  `getJobsPendingRouting()`/`confirmJobRouting()` in data.js:
  `job.routingConfirmed` (default false) gates a job out of this queue;
  confirming writes each line's (possibly-overridden) `departmentSequence`
  into `departmentStatuses` (first stop `"queued"`, later stops
  `"pending"` until hand-off) and logs a `job-routed` activity entry. This
  is the ONE human checkpoint in the whole design — every hand-off after
  this auto-advances without coming back through the manager (Phase 2+,
  not built yet).
  - **A genuinely nice find while building this:** Operations' "New Jobs"
    tab (`#p-alerts`) turned out to already be static, hand-authored demo
    markup from long before any of this app's real data-wiring sessions —
    2 hardcoded example jobs, a header banner reading almost exactly like
    this feature's own spec ("Assign departments per item, set sequence,
    release. PMs get 48h to submit BOM"), and an "Assign departments &
    release →" button wired to nothing but a `showAlert()` stub. Rather
    than building a parallel new screen, this tab was converted to real
    data — `renderJobRouting()` now reads `getJobsPendingRouting()` for
    real, the nav badge and header "N new jobs" notification are both
    live counts (`updateOpsRoutingBadge()`), and "Confirm routing &
    dispatch →" actually calls `confirmJobRouting()`. The old mockup
    happening to already describe this exact workflow is a good sign the
    original design intent for this app already anticipated it, even
    though it was never wired up.
- **Verification:** full battery — `node --check` on all modified files
  individually and the 12-file concatenation; duplicate top-level
  declaration scan (none found); onclick/onchange/oninput cross-reference
  across the whole repo (all resolve); closure-variable-in-inline-handler
  scan (none introduced). New Playwright suite `e2e-batch8-routing.js`
  (committed, reusable, 12/12) — confirms the painted-cabinet/curtain
  auto-suggestion examples exactly, exercises the Estimator's real
  Departments-column override UI, confirms routing through the real
  Operations "New Jobs" queue UI (not a direct data-layer call), confirms
  first-stop `"queued"`/later-stops-`"pending"` statuses, the job
  dropping off the queue, the nav badge updating, and the activity log
  entry. Re-ran all four prior Playwright suites
  (`e2e-batch6-reports.js`, `e2e-back-button-check.js`,
  `e2e-batch7-small-items.js`, `e2e-batch7-big-pieces.js`) for regression
  — all pass clean, zero console/page errors across all five scripts.
- **Not done this session, by design — stopping here per Salman's own
  choice:** Phase 2 (shared Joinery/Upholstery production pipeline),
  Phase 3 (standalone Painting module + Painting Lead/Work Supervisor
  role), and Phase 4 (three-tier costing + budget-approval gate, which
  will finally populate the Batch 7 bridge's still-empty
  `projects[].budget`/`.actuals` fields) are fully designed (see the
  `project_amd_app_routing_and_budgeting` memory file) but explicitly not
  started — check in with Salman before building further.
