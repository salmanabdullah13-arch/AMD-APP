# End-to-end run — iteration 2 findings (exception branches)

Iteration 2 drives the branches a job takes when something goes wrong:
sent back for re-costing, over the BD 8,000 line, a discount over the
ceiling, a variation on a live job, a BOM revision mid-cut, material short
at the lane, overtime with nothing to work on, QC failing twice, a job
cancelled mid-production, partial delivery and partial invoicing, a
near-duplicate customer, COM fabric short, a suite that will not come off
one roll, a crew's day paused and ended, and a delegated estimate.

Numbering continues from iteration 1 (F1–F8). Final pass: **220/221** (seven passes; the one remaining failure is F9, a design decision).
Report: `iteration-2-report.md`. Residue purged with `purge-run-residue.js`.

## F9 · The 30% discount ceiling lives only in the Estimator screen — open (design)

`setQuoteDiscount()` applied 40% without a gate. The 6a package routes a
discount over 30% to the Approver; that rule exists in `EstimatorUI` and
nowhere else, so the raw API, the Excel round-trip and any future screen
can apply any discount. Server-side, the pricing-lock trigger covers Sales
only. **Needs a decision**: route-to-Approver at the data layer (a
`discountNeedsApproval` state the Approver clears), or a hard ceiling.

## F10 · Two roles writing one job card lost each other's columns — FIXED

The run's clearest data loss: a delivered quantity went **backwards**.
Operations raised a delivery note; Accounts, holding a copy a few hundred
milliseconds stale, raised an invoice; the invoice write sent the WHOLE
row, `items` included, and put the delivery back to zero. Separately, the
realtime handler replaced a local job card unconditionally on every UPDATE,
so a session mid-edit could have its edit overwritten by any other role's
write.

**Fixed, `data.js`** — the same shape as F6, on job cards: a
`cloudJobCardRows` map holds each job card as the SERVER last held it; a
write sends only the columns that changed against it (`jobCardRowDiff`); a
realtime row never replaces a job card with unpersisted local edits (the
next write merges them); and once a write completes, columns another role
changed in the meantime are merged onto the local job.

**The first cut of the fix was itself wrong, and worth recording.** The
base was stored as the row object itself, and `jobCardRowToObj()` hands the
local job the row's own arrays (`items`, `department_budgets`, …). Mutating
the job mutated the base, so every nested-column edit read as "no change":
routing persisted its three flags and dropped the routed lines and the
budget slots — production could never submit a budget. Found by a
three-session diagnostic reading each session's local copy, its base and
the live row side by side. The base is a deep copy now.

**It had bitten on quotations too, and a probe proved it.** The variation
in X4 kept coming back `approver/draft` inside the run while passing in
isolation. A per-session log of every quotation write attributed it: the
Estimator's burst queued five whole-row writes at 26.062, the Approver
approved at 27.566, and the Estimator's last queued write drained after
that. The second cut of the fix had the same hole in one place — when a
remote row was skipped because the local copy was dirty, the base still
moved to it, so the next queued write re-sent the stale columns over it.
The sync is one shared piece now (`cloudRowSync`, `data.js`) for both
columnar tables: the base moves only when the local record moves, a remote
row that arrives during unsent edits is held in `pending`, and it is merged
after the write lands.

Verified live: `e2e-cloud-jobcard-merge.js` 17/17 — routing's three nested
columns all reach the row; Operations moves a line while Accounts invoices
150 ms behind and the live row, both sessions and a fresh login hold both;
then the Estimator's five-write burst with the Approver 1.5 s behind, and
the row holds the approval with the Estimator's BOM and routing intact.

## F11 · A suite's fabric ticket was written for one piece — FIXED

`releaseFabricPlan()` planned the spec's panels as written — and a spec is
per PIECE. Eight dining chairs were released off a roll that held one
chair's metres, so "the suite comes off one roll" was true of a ticket that
was not the suite. `jobFabricNeed()` used `metresPerPiece × pieces` — a
standing allowance that disagreed with the panel arithmetic (9.6 m against
5 m for the same job).

**Fixed, `upholstery-data.js`**: the ticket is every panel × the pieces on
the job card, and the need is derived by the same arithmetic. Two rolls of
60% of the need each are now both refused, which is the scenario's point.

## F12 · A delivery note for a fully delivered line was accepted — FIXED

`addDeliveryNote()` clamped the quantity to what was left, so a third note
on a line already at 2/2 recorded a note with zero movement instead of
refusing. It refuses now: *"Nothing on this note is left to deliver."*

## F13 · Delegation needs no reason — open

`delegateQuotation()` records a note if given, and accepts none. Every
other hand-over in the app that changes who owns a record requires one
(`rejectCustomer`, a declined material request, a manual completion).
Policy call, not a bug.

## F14 · Four job-card fields Operations sets never had a column — FIXED

`urgent`, `promisedDate`, `targetDate` and `notes` — set at routing and on
the job hub since 6 and 9 Aug — were written to the local object and
dropped by `jobCardObjToRow()`: no column, no mapping. Every promised date
and every urgent flag vanished on reload. Found reading the mapper while
fixing F10, not by a scenario. **Fixed**: four columns
(`supabase/fixes-2026-09-05.sql`, applied live and mirrored into
`schema.sql`) and both mapper directions.

## F15 · The crew clock silently ignored a 100% marker — FIXED

`endCrewSession()` dropped an out-of-range progress figure and ended the
day anyway; a wrong marker on an ended day cannot be corrected. It refuses
now: *"Progress is 25, 50 or 75 — 100% comes from QC."*

## F16 · Every lane slot's material claim was refused server-side — FIXED

A lane slot claims its boards (26 Aug: `allotLaneSlot → reserveJobMaterial
→ reserveStockForJob`), and the person allotting it is the production
manager. `stock_reservations` accepted writes from the store side only, so
each claim came back **403** and lived only in that session — the next
login, and every other session, saw the boards as free. Invisible in the
UI; found only because the driver captures refused HTTP writes per role.
**Fixed**: the production side may write reservations (issues, transfers
and counts stay the store's own).

## F17 · Notifications addressed to a role name reach nobody, or fail outright — open (design)

`messages.recipient_name` is a foreign key to `allowed_identities`, the
sign-in roster. Two consequences, both invisible in the UI because every
notification is fire-and-forget:

- `confirmJobRouting()` and `handOffLine()` message *"Joinery Production
  Manager"* — a roster pseudo-identity nobody signs in as. The real manager
  signs in as a person (`user_type = joinery_production_manager`) and never
  reads that inbox. Delivered, to nobody.
- A recipient that is not a roster name at all is refused with a **409**:
  the Owner's over-BD-8,000 recommendation goes to `"Owner"` (the roster has
  "Salman Abdullah"), and a delegation to `"Arun Kumar A"` (the payroll
  spelling; the roster has "Arun Kumar"). Both were captured by the driver's
  per-role response hook and confirmed against the live roster.

**Needs a decision**: resolve recipients at send time by `user_type` to
every approved profile holding it, and have `sendMessage()` surface a
refused send rather than swallow it.

## F18 · 409 conflicts during the run — RESOLVED (two causes, neither a defect)

Captured with URLs in pass five: `POST /rest/v1/enquiries` from Sales was
the driver's own foreign-key race (the near-duplicate scenario raised an
enquiry on a customer created a millisecond earlier — a person takes
longer; the driver now waits); `POST /rest/v1/messages` from the Estimator
and Operations were the two non-roster recipients recorded under F17.

## What the harness learned

- **A failed persist is only a toast.** Every `persist*` reports failure
  through `commsToast()` and nothing else, so a dropped write looked exactly
  like a logic bug until the driver captured toasts per session.
- **DNS in this environment blips.** Two passes lost steps to
  `getaddrinfo ENOTFOUND api.supabase.com`; a write that fails that way is
  a toast (above), not an error.
- **Snapshot primitives at the point of call.** The data layer hands back
  live objects; reading `status` after a later mutation reports the later
  state.
- **A foreign key between two records created in the same evaluate is a
  race.** The near-duplicate flag references the customer created a
  millisecond earlier; a person takes longer.
