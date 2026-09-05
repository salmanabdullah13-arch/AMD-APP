# End-to-end run — the scenario matrix

Written before the first iteration (3 Sep 2026), so each step is checked
against a prediction rather than rationalised after the fact. Every step is
run **as the real role that does it**, against the **live project**, and
checked three ways: the screen shows it, the data layer has it, a second
signed-in session sees it after a reload.

Fixture logins (`create-role-fixtures.js`): one per role, `E2E <Role> Account`,
all sharing the live suites' fixed password. Seeding and purging on the live
project are granted for the run (Salman, 2 Sep 2026); teardown is manifest-
based, so nothing real is ever matched.

## Iteration 1 — happy paths, one suite per division

| # | Scenario | Steps (role → action) | Expected at the end |
|---|---|---|---|
| S1 | **Joinery** — a wardrobe | Sales: customer, enquiry, quotation with a group, photo · Estimator: BOM from the Item Master, routing carp, transfer · Approver: approve · Sales: confirm to Job Card · Operations: route with a target date, approve the budget · Production: BOM budget from the request, lane slot with items, cutting list, the crew clock for a day, progress 50 · Joinery: sub-stages, QC pass (authority), hand-off · Store: put-away, reservation, issue against the job · Delivery: scheduled, delivered (refused until production complete) · Accounts: invoice 100%, receipt, credit note · Owner: every number visible | Job `completed` by derivation; ledger holds the clock's day-logs; invoice balance nets to zero; every dashboard shows the job |
| S2 | **Joinery + Paint** — a painted TV unit | as S1, with `carp,paint` on one line; paint's booth day is a derived slot that moves when joinery's moves; the painting lead's QC; both budgets in one submission | Both department budgets approved; the pulled date tracks the upstream one |
| S3 | **Upholstery** — a 3-seater sofa | Sales → Estimator (pricing input asked of the upholstery supervisor, answered in metres and hours) → Approver → Job · Upholstery: frames stage, roll received and inspected, foam schedule from the spec, plan released off one roll, cutting, sewing and bays as pulled slots, finishing & QC pass, hand-off · the crew clock on the bays · Delivery · Accounts | The ticket's "Fabric to cut" equals the builder's; the roll's free metres drop by exactly that; QC under the manager's authority |
| S4 | **Curtain** — wave curtains, two windows | Sales (division Curtain & Blinds) → Estimator → Approver → Job · bridge into `curtainJobs[]` · Curtain: windows, stitching, tracks, QC, install scheduled · the crew clock for the install crew (installation + steaming) · Delivery marks delivered · Accounts | Curtain job delivered without a `curt` pipeline entry blocking it; install hours in the ledger at real rates |
| S5 | **Mixed quotation** — curtains + painted TV unit + sofa on one job | one quotation, three lines routed `curt` / `carp,paint` / `uph`; each department's own module sees only its line; Owner sees all three | No line stranded: the curtain line reaches `curtainJobs[]`, the others reach their queues |

## Iteration 2 — exception branches (each layered on S1–S5)

| # | Branch | Where it forks | Expected |
|---|---|---|---|
| X1 | Approver sends back for re-costing | after Estimator transfer | quote returns to the estimator's queue, audit entry, re-transfer works |
| X2 | Over BD 8,000 — Operations recommends, Owner counter-signs | at approval | the counter-sign state survives a reload; no Job Card until the Owner signs |
| X3 | Discount over 30% | Estimator | routed to the Approver, not applied silently |
| X4 | Variation order after confirmation | on a live job | merges onto the same Job Card; a new department gets a budget slot; the quote stays frozen |
| X5 | BOM revision mid-cut | Production | the cutting list dies; the lane refuses until the sheet is off the saw |
| X6 | Material short at lane allotment | Production | refused with the reason; the waiting strip shows it; reserve clears it |
| X7 | Overtime to recover | Production / Upholstery | refused with no cause; refused on an idle stage; booked against a target |
| X8 | QC fail with rework | every department | the reason travels; the line returns to production; the second pass hands off |
| X9 | Cancel mid-production, then un-cancel | Jobs | everything locks, then unlocks; the quote unfreezes for correction |
| X10 | Partial delivery and partial invoice | Delivery / Accounts | delivered quantities per line; invoices stack to exactly 100% and refuse beyond |
| X11 | Near-duplicate customer | Sales | flagged for Accounts, not blocked; Sales works on it meanwhile |
| X12 | COM roll lands short | Upholstery | the table refuses until the note is signed and countersigned |
| X13 | Two lots for one suite | Upholstery | the plan will not release |
| X14 | A crew on two clocks; a pause without a reason | the crew clock | both refused |
| X15 | Delegated estimate; a tender with a closing date | Estimator | delegation pings; the tender is the queue filtered, not another screen |

## Iteration 3 — adversarial (raw API, wrong role, stale state)

| # | Attack | Expected |
|---|---|---|
| A1 | Sales session updates a quotation's item rate through the raw API | refused by the pricing-lock trigger |
| A2 | Sales reads `customer_banking_details`, `rfqs`, supplier quotes | zero rows / refused |
| A3 | A joinery login reads a pure-curtain job card; writes to `uph_stage_slots` | zero rows; refused |
| A4 | An unapproved (pending) account reads anything | nothing |
| A5 | A second Job Card from an already-confirmed quotation | refused |
| A6 | Approve a Sales-stage draft directly | refused (stage gate) |
| A7 | Reload mid-step on every role (the landing screen before hydration) | the screen redraws when the caches land |
| A8 | Two devices: confirm on one, watch the other | realtime lands within seconds |
| A9 | An answer to a pricing request carrying a money-shaped key | refused client-side AND by the database trigger |
| A10 | The same action twice (double tap on Start, Submit, Confirm) | one record |

## Iteration 4 — regression

Iterations 1 and 2 re-run after fixes, plus the full offline sweep and every
live-cloud suite.

## The design audit (runs alongside)

At the same point in the story, every dashboard is screenshotted at 390px and
1440px in light and dark, graded against one checklist drawn from the design
packages (shell non-negotiables, stat-strip geometry, label-above-bar, scroll
clearance, empty-state copy, status vocabulary, date and currency format,
badge tones, the page template shape, the money rule per role), and the
"first five seconds" test per role. Outliers are the modules that predate
the packages: Curtain, Jobs, Accounts, Approver, HR, Fleet, the legacy
Storekeeper screens.
