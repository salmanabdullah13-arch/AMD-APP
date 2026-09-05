# End-to-end run — iteration 3 findings (adversarial)

Iteration 3 attacks the system as the roles would if they meant harm: raw
API writes with the wrong role, supplier prices and bank details reached
for by Sales, a joinery login reading a curtain job, a pending account
signing in through the API, a second Job Card from a confirmed quotation,
approval of a draft that never went through estimation, a reload before
the caches hydrate, two devices, a pricing answer carrying money, and the
same action tapped twice. Two attacks were added for the decisions taken
on iteration 2's open findings: a discount above the role's tier (F9) and a
routing ping that must reach the person holding the role (F17).

Final pass: **180/180** (four passes). Report: `iteration-3-report.md`. Residue purged with
`purge-run-residue.js`.

## What held on the first pass, before anything was changed

- **A1** — the pricing-lock trigger refused a Sales session's raw rate
  change, a 40% discount written into the items, and a smuggled priced
  line, while letting a non-pricing field through; the live items were
  byte-for-byte unchanged.
- **A2** — customer banking details, RFQs and goods receipts return zero
  rows to Sales; an RFQ insert is refused; the item master is readable (the
  BOM typeahead needs it) but a cost cannot be changed.
- **A3** — a pure-curtain job card is invisible to a joinery login (zero
  rows, not an error) and cannot be written; upholstery's stage slots
  refuse; customers and quotations are read-only for a production role.
- **A4** — a pending account authenticates (approval is the gate, not the
  password) and then reads nothing from any business table and cannot
  insert a customer.
- **A5, A6** — a second Job Card from a confirmed quotation, re-approval of a
  confirmed quotation, and approval of a draft at the Sales or Estimator
  stage are all refused; exactly one live Job Card exists on the table.
- **A8** — a Job Card confirmed on one device reached the Owner's device
  through realtime in under a second, already bridged into the Operations
  rollup with its value read live.

## F9 · Discount tiers by role — BUILT

Salman's rule: Sales up to 10%, the Estimator up to 20%, the Owner up to
30%, configurable from a masters page. Built in three places so the
end-to-end run cannot walk past it again:

- **`setQuoteDiscount()`** judges the caller's tier (`discountLimitFor`),
  refusing with the limit and who could apply it. The Estimator screen's
  discount — previously a screen-only figure (`q.discountPercent`, read
  nowhere else, never persisted) — now goes through the same function, so
  Sales, the Estimator and the print documents see one number. Its
  percentage is taken of the record's item amounts, the base the function
  judges, not of the screen's live working figure.
- **Admin → Discount Limits** — a ceiling per role and a per-person override
  that wins over the role, persisted as the `discount_limits` cloud
  collection so a change reaches every device, and logged.
- **A database trigger** (`quotation_discount_limit`, `supabase/discount-
  limits.sql`) refuses any line whose discount RISES past the caller's
  ceiling, so the raw API is held to the same tiers. A line already carrying
  a higher discount applied by a higher tier may still be edited for
  anything else. A caller with no `auth.uid()` (the SQL editor) is not
  limited — that is the administrator, not a role.

`e2e-discount-tiers.js` 23/23 offline; A12 proves the trigger live.

## F17 · Notifications by role — BUILT

A hand-off pings *"Joinery Production Manager"*, a roster name nobody signs
in as. In a real session `sendMessage()` now resolves a role name to every
approved profile holding that role (`window.__profiles`, fetched at login),
so the ping lands in the real manager's inbox; a refused send is surfaced
as a toast rather than swallowed. The Estimator's delegate list is the
people who sign in as an Estimator, not the payroll spelling that could
never be notified. A11 proves it live: the routing ping reaches the joinery
manager's own inbox.

## F13 · Delegation reason — kept optional (Salman's call)

## F19 · After a reload, a landing screen stayed empty — FIXED

A7 reloads every role mid-step. Each signed back in and hydrated its
caches (36 job cards), yet Sales' landing screen never showed the job it
had just confirmed; a manual `renderSalesBody()` did. The screen renders
before the caches land and nothing tells it to redraw — the class fixed
for Production on 25 Aug, which only Production received. Operations and
Production were not this bug: their screens simply do not print a project
name (the first pass's needle), and the driver now looks for what each
screen actually shows — the routing queue with the step selected, and the
waiting strip's real data.

**Fixed, `exec-shell.js`**: one hydration listener for every module —
when the data lands it redraws whichever dashboard is on screen, through
the shell's existing per-module render map, never over a field being
typed in and never a module with its own listener. `bridgeAllJobCards()`
now notifies when the job cards are usable, since they are the last of the
business data to be ready.

The first cut fired four times per login and drew nothing: it asked the
shell's `execVisibleShell()` which module is on screen, and that helper
tests `offsetParent` — which is **always null for a `position:fixed`
element**, and every module wrap is fixed. Visibility is judged by
computed display now. Worth knowing for anything else that consults that
helper.

## What the harness learned

- **A double tap is not always a second call.** `frontHalf` already routes
  the job it confirms, so a "route twice" attack written after it was
  really a third call; the first pass reported the app refusing correctly
  and the driver reading it as a failure. Check what the seed already did.
- **A screen shows its first rows, the data holds all of them.** Operations'
  routing queue and Production's waiting strip were full of older residue
  jobs, so a new job was in the data and not in the first three lines. The
  reload check now asks the screen for its real data and for a non-empty
  render, not for one specific id in the visible text.
- **Read the record's field names, not the design's.** A budget awaiting
  approval is `pending`, not `submitted`; an invoice carries `jobId`, not
  `jobCardId`; a pricing request's type is `pricing_input`. Three failures
  on the first pass were the driver's vocabulary.
