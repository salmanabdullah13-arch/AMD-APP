# AMD — CURRENT STATE

*(update this file at the end of each session; keep the instructions file unchanged)*

## BUILT & LIVE
- Operations module — 9 screens, fully wired
- Curtain & Blinds module — 6 screens, fully wired (Silva's workshop + install)
- Purchaser module — 4 screens, fully wired (Request → PO → Invoice)
- Storekeeper module — built, index.html wiring just completed this
  session (script tag + ecosystem hub node + touch-launch registry).
  **NOT YET DEVICE-TESTED** — see checklist below.

## NEXT UP — device-test Storekeeper (do this first, before any new build)
- Open Storekeeper from the ecosystem hub node — dashboard loads, KPI
  counts correct
- Search by item name and by source invoice number
- Release a FULL-quantity entry — disappears from In-Pool, appears in
  Release History with right dept/job/issuer
- Release a PARTIAL quantity — original entry stays in-pool with reduced
  qty, new STK-XXXX entry appears in Release History
- Confirm itemCard created: console check
  `itemCards.filter(c => c.jobId === '<jobId>')` — sourcePO traced through
  sourceInvoice where applicable
- Try releasing without a job — blocked with "job required"
- Try releasing more than available qty — blocked with "only X available"
- Regression-check Purchasing (PR/PO/Invoice flows) and Pipeline Board
  still work unchanged (this build touched shared code: issueItemCard
  signature, shell.js goTo())
- Visually check the new Storekeeper ecosystem node (top of ring, near
  Purchaser/Owner) doesn't look cramped — coordinates were placed without
  visual rendering; nudge cx/cy on #node-storekeeper / #line-storekeeper
  in index.html if needed

## NEXT BUILD — pick one (after Storekeeper device-test passes)
1. **sw.js** — offline/PWA install support (app is online-only right now)
2. **Operations wiring** — getJobLoggedHours() into a cross-check UI;
   job.accountsAlert into the Operations alert feed (needs operations.js
   in context)
3. **Real Reminders log** — new reminders[] array in data.js (schema change,
   own session) so Subcontractors/Payments/Variations actions actually
   get logged instead of just showing a toast

## ON THE HORIZON — not started
- Carpentry / Upholstery / Metal Works PM views (Purchaser raise-PR flows
  for these deferred until the modules themselves exist)
- Item-level data model for Carpentry/Painting/Upholstery/Metal Works jobs
  (only Curtain jobs have structured window/item data via windowGroups —
  everything else is free-text item ref for now)
- No dedicated itemCards[] viewer yet — Storekeeper release generates
  them but nothing displays the log
- Pipeline board (Job → Window → Stitching/Track/QC/Ready for delivery) —
  Salman's idea, deferred as its own session
- Sales/Estimation module — Phase 4, long horizon
- Real per-person BD/hr rates for WORKER_RATES — still placeholders
- Purchaser self-originate PR/PO/Invoice flows (three new form panels +
  createPurchaseOrderDirect/createPurchaseInvoiceDirect/approveInvoice/
  rejectInvoice in data.js) — was confirmed and ready to build a couple
  sessions ago; check whether this landed before Storekeeper or is still
  pending
