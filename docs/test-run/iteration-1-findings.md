# Iteration 1 — findings (3 Sep 2026)

What the first pass of the end-to-end run found, in the order it found it.
The generated step table is in `iteration-1-report.md`; this is the
diagnosis behind each failure. **Fixed** means fixed in this pass because it
blocked the run itself; **open** means recorded for the fix phase.

## F1 · Every sequence id was length-based — FIXED

The very first live step collided: a brand-new quotation was minted as
`AMD-15350-0`, an id that already existed, so the app treated the new quote
as one already confirmed into another job and refused to transfer it.
Nine id minters (`nextCustomerCode`, `nextEnquiryNo`, `nextQtnNo`,
`nextInvoiceNo`, `nextReceiptId`, `nextCreditNoteId`, `nextPRId`,
`nextSupplierId`, `nextPOId`, `nextInvoiceId`, `nextPaymentId`,
`nextDebitNoteId`, `nextSANumber`, `nextCatelogId`, `nextVehicleId`,
`nextEmployeeId`) read `array.length`. Once rows can be deleted — two purges
by then — the array has gaps and length no longer tracks the highest id.
The collision is silent locally (`find()` returns the OLD record) and only
fails at the primary key, with a toast. Same class as the job-number
collision found on 26 Aug. All are max-based now (`nextSeqFrom()`).

**Still open underneath it**: ids are minted client-side from the local
cache. A session that acts before its cache hydrates (about 3 s after
login) mints from the seed data alone. A user who opens the app and creates
a customer within three seconds can still collide. The durable fix is a
server-side sequence per table, or refusing creates until
`businessDataReady` resolves. Recorded as **design-level**.

## F2 · An Estimator could not raise a pricing request live — FIXED

`production_input_requests`' write policies named only the production and
upholstery sides. The Estimator's `pricing_input` (and Sales'
`fabric_change`) inserts were refused by RLS: the request existed in that
one browser and nowhere else, so the upholstery supervisor never saw it.
Who may raise a request is the `raiserRole` check in `raiseInputRequest()`;
the table now lets any approved user insert and update
(`supabase/fixes-2026-09-03.sql`). The commitment-3 trigger keeps applying.

## F3 · The standing upholstery specs vanished in a live session — FIXED

`upholstery-data.js` seeds eight standing specs at load; hydration then
REPLACES the array with the table's contents, which was empty. Every piece
resolved to "No spec released yet — operations still has it" and the whole
serial line stalled at frames. The eight rows are seeded on the project
now, and `seedUphSpecs()` re-seeds after hydration if the table ever comes
back empty. **Lesson**: a local seed on a cloud-backed collection is a
seed for the offline suites only; the live project needs the rows.

## F4 · A curtain crew was asked to tick items it never has — FIXED

`startCrewSession()` required items whenever the job card had lines. A
curtain or site crew clocks on to the job as a whole (the ledger allows
`lineId: null`); the rule now applies only to workshop crews.

## F5 · A delivery note with no `requiredQty` is accepted and delivers nothing — open (minor)

`addDeliveryNote()` created an empty note and called auto-complete rather
than refusing. The UI always sends `requiredQty`, so this is a data-layer
hole, not a screen bug.

## F6 · Windows authored on a freshly bridged curtain job did not persist — FIXED (5 Sep)

Two of three runs (the third, full pass persisted within the window): the curtain manager's session authored a window group and
scheduled the install on the job Sales had just confirmed; four seconds
later the live row still carried `windowGroups: []` and status
`bom_pending`. The same edit on an older job persists within three seconds
(`_probeCurtain`, two sessions open). Evidence points at the bridge: a
session that hydrates and then runs `bridgeAllJobCards()` re-upserts every
bridged curtain row — at the probe's login, four rows' `updated_at` moved
at once, including two that nobody had touched — so a login (or the
realtime job-card INSERT, which also bridges inline) can overwrite a
concurrent edit with the bridge's fresh copy. Needs the scanner's snapshot
taken AFTER the bridge, and the inline bridge not to create an entry the
cloud row is about to supply. **Data-loss class; fix first.**

**Fixed, 5 Sep 2026** — three things, all in `data.js`: (1) a job card
arriving through realtime no longer builds a curtain entry of its own when
the curtain collection is cloud-backed (the confirming session's row is on
its way and must be the only copy); (2) every snapshot comparison in the
json-collection sync goes through one canonical, key-sorted, LOCAL form —
jsonb reorders keys on the way back, so the raw-string echo test never
matched our own write and every echo replaced the local object; (3) a local
record with unpersisted edits is never replaced by a remote copy — the
snapshot moves to the remote version and the next scan pushes the local one
(last-writer-wins, but it can no longer lose the writer mid-edit). A first
cut of (3) compared the local form against a raw-form snapshot and made a
clean record read as dirty; the live suite caught it. `e2e-cloud-bridge-race.js`
drives the exact race with three sessions and reads the live row back: 7/7.

## F8 · A production role's session logs HTTP 403s during a mixed run — open (low)

The joinery production manager's session emitted several 403s while S3 and
S4 ran in other sessions, and none at login or idle. On this stack a 403 is
a write refused by a policy for that role. The likely writer is the bridge
that runs on a realtime job-card INSERT: it touches job cards of OTHER
departments, which the department-scoped policy correctly refuses. No data
of the joinery role's own is lost, but a refused write is silent to the
user, and the bridge should not be writing there at all. The driver now
records the refused URLs per role so iteration 2 can name the caller.

## F7 · The store dependency is real and honest — no change

The upholstery line could not book cutting until the store held the foam
grade the spec calls for. The scenario now puts foam on the shelf as the
storekeeper first, which is the real order of things. Worth knowing for
anyone testing by hand: an empty store blocks every workshop at the first
material gate, by design.

## What held

Fourteen roles signed in against the live project; the pricing lock, the
approval stage gate, the double-confirm guard, routing, the budget
maker-checker, the lane gate, the crew clock writing the ledger, the store's
no-job refusal, the deliver-before-production block, the invoice cap, and
the mixed quotation reaching three departments all behaved as specified.
Realtime carried every hand-off to the next role's session within the
15-second window on every scenario.
