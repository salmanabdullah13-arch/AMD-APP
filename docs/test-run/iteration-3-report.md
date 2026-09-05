# End-to-end run — iteration 3 (adversarial)

Run 2026-09-05 13:17 · 180/180 checks passed · 291 s · manifest test-run/iter3-manifest.json

## A1 Sales tampers pricing through the raw API

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1839"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04314AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15602-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15602-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | sales | A rate change is refused by the pricing-lock trigger | PASS | Sales cannot modify pricing on a quotation line — pricing must go through the Estimator. |
| 8 | sales | A 40% discount written into the items is refused (the discount-tier trigger fires first; the pricing lock stands behind it) | PASS | A 40.0 discount is above your limit of 10 — it needs a higher tier. |
| 9 | sales | A smuggled priced line is refused | PASS | Sales cannot set pricing on a quotation line — pricing must go through the Estimator. |
| 10 | sales | A non-pricing field still updates (the trigger is not blocking everything) | PASS | null |
| 11 | sales | The live items are byte-for-byte what they were | PASS | {"before":1,"after":1} |

## A2 Sales reaches for supplier prices and bank details

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Customer banking details: zero rows for Sales | PASS | {"bank":0,"bankErr":null,"rfq":0,"gr":0,"ins":"new row violates row-level security policy for table \"rfqs\"","imRows":0,"imErr":null,"imSel":1} |
| 2 | sales | RFQs and goods receipts (supplier prices): zero rows for Sales | PASS | {"bank":0,"bankErr":null,"rfq":0,"gr":0,"ins":"new row violates row-level security policy for table \"rfqs\"","imRows":0,"imErr":null,"imSel":1} |
| 3 | sales | Inserting an RFQ as Sales is refused | PASS | new row violates row-level security policy for table "rfqs" |
| 4 | sales | Sales can read the item master (the BOM typeahead needs it) but cannot change a cost | PASS | {"bank":0,"bankErr":null,"rfq":0,"gr":0,"ins":"new row violates row-level security policy for table \"rfqs\"","imRows":0,"imErr":null,"imSel":1} |

## A3 Joinery reaches across departments

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1840"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04315AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15603-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15603-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15603-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15603-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01186","amount":29.757} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01186 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["curt"]} |
| 14 | joinery_production_manager | A pure-curtain job card is invisible to a joinery login (zero rows, not an error) | PASS | {"sel":0,"selErr":null,"upd":0,"updErr":null,"uph":"new row violates row-level security policy for table \"uph_stage_slots\"","cust":0,"custErr":null,"qtnErr":n |
| 15 | joinery_production_manager | … and cannot be written (zero rows affected) | PASS | {"sel":0,"selErr":null,"upd":0,"updErr":null,"uph":"new row violates row-level security policy for table \"uph_stage_slots\"","cust":0,"custErr":null,"qtnErr":n |
| 16 | joinery_production_manager | Writing to upholstery's stage slots is refused | PASS | new row violates row-level security policy for table "uph_stage_slots" |
| 17 | joinery_production_manager | Customers and quotations are read-only for a production role | PASS | {"sel":0,"selErr":null,"upd":0,"updErr":null,"uph":"new row violates row-level security policy for table \"uph_stage_slots\"","cust":0,"custErr":null,"qtnErr":n |
| 18 | joinery_production_manager | The live job card carries no trace of the attempt | PASS |  |

## A4 A pending account signs in through the API

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | pending | The account signs in (authentication is not the gate — approval is) | PASS | {"customers":"0","job_cards":"0","quotations":"0","messages":"0","item_master":"0","lane_slots":"0","insert":"new row violates row-level security policy for tab |
| 2 | pending | Every business table returns zero rows to a pending account | PASS | {"customers":"0","job_cards":"0","quotations":"0","messages":"0","item_master":"0","lane_slots":"0","insert":"new row violates row-level security policy for tab |
| 3 | pending | A pending account cannot insert a customer | PASS | new row violates row-level security policy for table "customers" |
| 4 | driver | The fixture is restored to approved afterwards | PASS | [{"approval_status":"approved"}] |

## A5 A second Job Card from the same quotation

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1841"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04316AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15604-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15604-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15604-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15604-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01187","amount":29.757} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01187 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | sales | Confirming again is refused | PASS | A Job Card already exists for this quotation. |
| 15 | sales | Re-approving a confirmed quotation is refused (the stage gate fires first — it sits at Sales, confirmed) | PASS | Quotation must be with the Approver before it can be approved (currently at Sales). |
| 16 | sales | Exactly one live Job Card exists for it | PASS | 1 |
| 17 | sales | … on the live table too | PASS | [{"n":1}] |

## A6 Approve a draft that never went through estimation

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1842"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04317AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15605-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15605-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | approver | Approval at the Estimator stage is refused | PASS | {"err":"Quotation must be with the Approver before it can be approved (currently at Estimator).","stage":"estimator","lc":"draft"} |
| 8 | sales | Approval of a Sales-stage draft is refused even by an Owner-typed call | PASS | {"err":"Quotation must be with the Approver before it can be approved (currently at Sales).","lc":"draft","confirm":"Quotation must be Open before it can be con |
| 9 | sales | … and it cannot be confirmed to a Job Card | PASS | Quotation must be Open before it can be confirmed. |

## A7 Reload on every role — the landing screen before hydration

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1843"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04319AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15607-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15607-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15607-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15607-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01188","amount":29.757} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01188 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | sales | Sales creates the customer | PASS | {"customer":"C1844"} |
| 15 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04320AMD"} |
| 16 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15608-0","lines":[1],"rate0":true} |
| 17 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 18 | estimator | The Estimator sees it arrive | PASS | AMD-15608-0 |
| 19 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 20 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 21 | approver | The Approver sees the priced quotation | PASS | AMD-15608-0 |
| 22 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 23 | sales | Sales sees the approval land | PASS | AMD-15608-0 |
| 24 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01189","amount":29.757} |
| 25 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01189 |
| 26 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 27 | sales | Sales creates the customer | PASS | {"customer":"C1845"} |
| 28 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04321AMD"} |
| 29 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15609-0","lines":[1],"rate0":true} |
| 30 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 31 | estimator | The Estimator sees it arrive | PASS | AMD-15609-0 |
| 32 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 33 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 34 | approver | The Approver sees the priced quotation | PASS | AMD-15609-0 |
| 35 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 36 | sales | Sales sees the approval land | PASS | AMD-15609-0 |
| 37 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01190","amount":29.757} |
| 38 | sales | After a reload, sales's landing screen redraws with RUN1 A7 once the caches land (1290 ms) | PASS | {"signedIn":true,"session":true,"jobs":37,"wraps":["sales-module-wrap"],"text":"AL MARAYA DECOR « WORKSPACE ▦ Overview ☎ Enquiries ⎘ Quotations ⚒ My Jobs 𝄜 Rep |
| 39 | operations_manager | After a reload, operations_manager's landing screen redraws with New jobs once the caches land (768 ms) | PASS | {"signedIn":true,"session":true,"jobs":37,"wraps":["ops-module-wrap"],"text":"AL MARAYA DECOR « WORKSPACE ▤ Dashboard ◇ Quote approval ⇄ New jobs ✓ BOM verifica |
| 40 | joinery_production_manager | After a reload, joinery_production_manager's landing screen redraws with Waiting for a lane once the caches land (787 ms) | PASS | {"signedIn":true,"session":true,"jobs":20,"wraps":["prd-module-wrap"],"text":"AL MARAYA DECOR « WORKSPACE ⌂ Dashboard 1 ▦ Week board ∑ Pricing input 1 ⊟ BOM inp |
| 41 | owner | After a reload, owner's landing screen redraws with RUN1 A7 once the caches land (1030 ms) | PASS | {"signedIn":true,"session":true,"jobs":37,"wraps":["owner-module-wrap"],"text":"💬 AL MARAYA DECOR « WORKSPACE ▦ Overview 🗓 Week planner ✓ My tasks ✍ Sign-offs |

## A8 Two devices: confirm on one, watch the other

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1846"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04322AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15610-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15610-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15610-0 |
| 9 | owner | The Owner's device sees the new Job Card through realtime (990 ms) | PASS | {"c":{"job":"JB26AMD01191"},"w":{"ms":990,"job":"JB26AMD01191"}} |
| 10 | owner | … and the Operations rollup on that device is bridged, reading the job's value live | PASS | {"bridged":true,"val":29.757} |

## A9 A pricing answer carrying money

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1847"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04323AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15611-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15611-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15611-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15611-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01192","amount":29.757} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01192 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | estimator | The Estimator raises a pricing request | PASS | {"id":"REQ-0007"} |
| 15 | joinery_production_manager | Production's session sees it | PASS | REQ-0007 |
| 16 | joinery_production_manager | The client refuses a money-shaped key | PASS | "rate" is not something this role returns. Hours and quantities only — the estimator turns them into money. |
| 17 | joinery_production_manager | The database trigger refuses the same payload written raw | PASS | Production returns hours and quantities, not money. Remove "rate" — the estimator prices it. |
| 18 | joinery_production_manager | An answer in hours and men is accepted | PASS | {"client":"\"rate\" is not something this role returns. Hours and quantities only — the estimator turns them into money.","raw":"Production returns hours and qu |
| 19 | joinery_production_manager | The live answer carries hours and men, and no rate | PASS | {"men":2,"manHours":12} |

## A10 Double tap: Start, Submit, Confirm, Allot, Invoice

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1848"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04324AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15612-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15612-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15612-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15612-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01193","amount":29.757} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01193 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | operations_manager | Routing an already-routed job again is refused and changes nothing | PASS | {"b":"Routing already confirmed for this job.","same":true,"routed":true} |
| 15 | joinery_production_manager | Submitting a budget twice leaves ONE slot awaiting approval (a resubmission replaces, never duplicates) | PASS | {"slots":1,"status":"pending"} |
| 16 | joinery_production_manager | Starting production twice: the second is refused, the line is in production once | PASS | {"b":"Line must be Queued before starting production.","status":"in-production"} |
| 17 | accounts | Invoicing 100% twice: the second is refused, one invoice exists | PASS | {"b":"This job is already fully invoiced (100%).","n":1} |
| 18 | accounts | … one invoice on the live table | PASS | [{"n":1}] |

## A11 A hand-off notification reaches the person holding the role

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1849"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04325AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15613-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15613-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15613-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15613-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01194","amount":29.757} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01194 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | The joinery manager's OWN inbox receives the routing ping (not a role-name inbox nobody reads) | PASS | JB26AMD01194 |

## A12 Discounts above the role tier: Sales 10%, Estimator 20%, Owner 30%

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1850"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04326AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15614-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15614-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | sales | Sales at 15% is refused (tier 10%) | PASS | {"err":"A 15% discount is above your limit of 10% — it needs the Estimator or the Owner.","applied":0} |
| 8 | sales | Sales at 10% is accepted | PASS | {"applied":10} |
| 9 | estimator | Estimator at 25% is refused (tier 20%) | PASS | {"err":"A 25% discount is above your limit of 20% — it needs the Owner.","applied":0} |
| 10 | estimator | Estimator at 20% is accepted | PASS | {"applied":20} |
| 11 | estimator | An Estimator session writing 30% straight to the row is refused by the database (tier 20%) | PASS | A 30.0 discount is above your limit of 20 — it needs a higher tier. |
| 12 | owner | Owner at 35% is refused (tier 30%) | PASS | {"err":"A 35% discount is above your limit of 30% — it needs nobody — the top tier is 30%.","applied":20} |
| 13 | owner | Owner at 30% is accepted | PASS | {"applied":30} |
| 14 | sales | A Sales session writing 30% straight to the row is refused by the database (the pricing lock covers Sales; a rise past 30% would also trip the tier) | PASS | Sales cannot modify pricing on a quotation line — pricing must go through the Estimator. |
| 15 | owner | The live discount stands at the last ACCEPTED tier, 30% by the Owner | PASS | 29.99966394461807 |

## Findings and notes

None.

## Console / page errors and refused writes by role

- **sales**: `HTTP 400 PATCH /rest/v1/quotations?id=eq.AMD-15602-0` · `Failed to load resource: the server responded with a status of 400 ()` · `HTTP 403 PATCH /rest/v1/quotations?id=eq.AMD-15602-0` · `Failed to load resource: the server responded with a status of 403 ()` · `HTTP 400 PATCH /rest/v1/quotations?id=eq.AMD-15602-0` · `Failed to load resource: the server responded with a status of 400 ()`
- **estimator**: `HTTP 403 PATCH /rest/v1/quotations?id=eq.AMD-15614-0` · `Failed to load resource: the server responded with a status of 403 ()`
- **joinery_production_manager**: `HTTP 403 POST /rest/v1/uph_stage_slots` · `Failed to load resource: the server responded with a status of 403 ()` · `HTTP 400 PATCH /rest/v1/production_input_requests?id=eq.REQ-0007` · `Failed to load resource: the server responded with a status of 400 ()`
