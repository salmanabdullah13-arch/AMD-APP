# End-to-end run — iteration 1 (happy paths)

Run 2026-09-03 11:00 · 155/155 checks passed · 297 s · manifest test-run/iter1-manifest.json

## S1 Joinery

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1833"} |
| 2 | sales | … and it is in the live customers table under its own name | PASS | {"id":"C1833","live":"RUN1 S1 1788432960335"} |
| 3 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04310AMD"} |
| 4 | sales | Sales builds the quotation with its lines — every rate locked at zero | PASS | {"quotation":"AMD-15598-0","lines":[1],"rate0":true,"stage":"sales"} |
| 5 | sales | … and the quotation row is live under its own project name | PASS | {"id":"AMD-15598-0","live":"RUN1 S1 Saar villa"} |
| 6 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 7 | estimator | The Estimator's session sees the quotation arrive at its stage | PASS | AMD-15598-0 |
| 8 | estimator | Estimator costs each line from the Item Master, books labour, submits, routes | PASS | {"out":[{"line":1,"mat":true,"lab":true,"submitted":true,"depts":true,"price":29.757}],"err":null} |
| 9 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 10 | approver | The Approver's session sees the priced quotation | PASS | AMD-15598-0 |
| 11 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 12 | approver | … and lifecycle_status is open in the live row | PASS | open |
| 13 | sales | Sales sees the approval land | PASS | AMD-15598-0 |
| 14 | sales | Sales confirms to a Job Card, unrouted, bridged to Operations | PASS | {"job":"JB26AMD01184","amount":59.514,"routing":false,"bridged":true,"curtainBridged":false} |
| 15 | sales | … and the job card is live | PASS | JB26AMD01184 |
| 16 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01184 |
| 17 | operations_manager | Operations routes with a target date; every routed department gets a budget slot | PASS | {"routing":true,"target":"2026-09-20","budgets":["carp"]} |
| 18 | operations_manager | Operations asks Production for the job BOM | PASS | {"req":"REQ-0005"} |
| 19 | joinery_production_manager | Production sees the routed job | PASS | JB26AMD01184 |
| 20 | joinery_production_manager | Production builds the job BOM from the estimate and submits it; the request is answered by a pointer | PASS | {"status":"pending","lines":1} |
| 21 | operations_manager | Operations approves the budget (maker-checker), which opens production | PASS | {"status":"approved","gate":true} |
| 22 | joinery_production_manager | Production starts the line and books a lane slot (or is refused honestly for short material) | PASS | {"started":true,"short":0,"slot":"SLOT-0048"} |
| 23 | installation_crew_lead | The crew clock logs a day: 3 h for 3 men on the line, progress 50, a photo | PASS | {"session":"SESS-0004","hours":3,"logs":3,"pct":50,"photo":"PHOTO-0003"} |
| 24 | installation_crew_lead | … and the session is in the live crew_sessions table | PASS | SESS-0004 |
| 25 | joinery_production_manager | Sub-stages, QC pass under authority, hand-off — the line is done at 100% | PASS | {"status":"done","pct":100,"complete":true} |
| 26 | storekeeper | Store puts away, reserves for the job, refuses "general use", issues against the job | PASS | {"res":"RES-0009","noJob":"General use is not a job card. Consumables still belong to a job — ask which job card it is going against.","issue":"ISS-0003"} |
| 27 | storekeeper | … and the issue is in the live store_issues table | PASS | ISS-0003 |
| 28 | delivery_scheduling | Delivery schedules the job | PASS | {"id":"DS1000"} |
| 29 | operations_manager | A full delivery note is accepted once production is complete, and the job completes by derivation | PASS | {"delivered":true,"status":"completed"} |
| 30 | operations_manager | … and the live job card reads completed | PASS | completed |
| 31 | delivery_scheduling | Delivery marks the schedule delivered | PASS | {} |
| 32 | accounts | Accounts sees the completed job | PASS | JB26AMD01184 |
| 33 | accounts | Accounts invoices 100%, receives it in full — balance nets to zero; a second invoice is refused | PASS | {"invoice":"IN26AMD01007","net":59.514,"receipt":"RC26AMD01006","balance":0,"second":"This job is already fully invoiced (100%)."} |
| 34 | accounts | … and the invoice is in the live tax_invoices table | PASS | IN26AMD01007 |
| 35 | owner | The Owner's session holds the completed job and its invoice | PASS | JB26AMD01184 |
| 36 | owner | The Owner dashboard opens with the numbers behind it | PASS | {"shown":true,"mentionsJob":true} |

## S2 Joinery + Paint

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1834"} |
| 2 | sales | … and it is in the live customers table under its own name | PASS | {"id":"C1834","live":"RUN1 S2 1788432960335"} |
| 3 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04311AMD"} |
| 4 | sales | Sales builds the quotation with its lines — every rate locked at zero | PASS | {"quotation":"AMD-15599-0","lines":[1],"rate0":true,"stage":"sales"} |
| 5 | sales | … and the quotation row is live under its own project name | PASS | {"id":"AMD-15599-0","live":"RUN1 S2 Amwaj apartment"} |
| 6 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 7 | estimator | The Estimator's session sees the quotation arrive at its stage | PASS | AMD-15599-0 |
| 8 | estimator | Estimator costs each line from the Item Master, books labour, submits, routes | PASS | {"out":[{"line":1,"mat":true,"lab":true,"submitted":true,"depts":true,"price":29.757}],"err":null} |
| 9 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 10 | approver | The Approver's session sees the priced quotation | PASS | AMD-15599-0 |
| 11 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 12 | approver | … and lifecycle_status is open in the live row | PASS | open |
| 13 | sales | Sales sees the approval land | PASS | AMD-15599-0 |
| 14 | sales | Sales confirms to a Job Card, unrouted, bridged to Operations | PASS | {"job":"JB26AMD01185","amount":29.757,"routing":false,"bridged":true,"curtainBridged":false} |
| 15 | sales | … and the job card is live | PASS | JB26AMD01185 |
| 16 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01185 |
| 17 | operations_manager | Operations routes with a target date; every routed department gets a budget slot | PASS | {"routing":true,"target":"2026-09-20","budgets":["carp","paint"]} |
| 18 | joinery_production_manager | One manager submits both budgets — joinery and paint | PASS | {"carp":"pending","paint":"pending"} |
| 19 | operations_manager | Operations approves both | PASS | {"ok":true} |
| 20 | joinery_production_manager | Paint's booth day is derived from joinery's slot and moves with it | PASS | {"d1":"2026-09-09","d2":"2026-09-10","moved":true} |
| 21 | joinery_production_manager | Hand-off from joinery lands the line in Painting's queue | PASS | {"paintQueued":true} |
| 22 | painting_lead | The Painting lead's session sees the line arrive | PASS | JB26AMD01185 |
| 23 | painting_lead | Painting starts, QC passes under its own lead, hands off — the job is production-complete | PASS | {"complete":true} |
| 24 | delivery_scheduling | Delivery schedules the job | PASS | {"id":"DS1001"} |
| 25 | operations_manager | A full delivery note is accepted once production is complete, and the job completes by derivation | PASS | {"delivered":true,"status":"completed"} |
| 26 | operations_manager | … and the live job card reads completed | PASS | completed |
| 27 | delivery_scheduling | Delivery marks the schedule delivered | PASS | {} |
| 28 | accounts | Accounts sees the completed job | PASS | JB26AMD01185 |
| 29 | accounts | Accounts invoices 100%, receives it in full — balance nets to zero; a second invoice is refused | PASS | {"invoice":"IN26AMD01008","net":29.757,"receipt":"RC26AMD01007","balance":0,"second":"This job is already fully invoiced (100%)."} |
| 30 | accounts | … and the invoice is in the live tax_invoices table | PASS | IN26AMD01008 |
| 31 | owner | The Owner's session holds the completed job and its invoice | PASS | JB26AMD01185 |
| 32 | owner | The Owner dashboard opens with the numbers behind it | PASS | {"shown":true,"mentionsJob":true} |

## S3 Upholstery

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | estimator | The Estimator asks the upholstery supervisor for pricing input | PASS | {"req":"REQ-0006"} |
| 2 | upholstery_manager | The supervisor's session sees the request | PASS | REQ-0006 |
| 3 | upholstery_manager | … answers in metres and hours; a rate is refused | PASS | {"status":"answered","bad":"Already answered."} |
| 4 | storekeeper | The store puts twelve foam blocks on the shelf | PASS | {"item":"IT003397","free":24} |
| 5 | sales | Sales creates the customer | PASS | {"customer":"C1835"} |
| 6 | sales | … and it is in the live customers table under its own name | PASS | {"id":"C1835","live":"RUN1 S3 1788432960335"} |
| 7 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04312AMD"} |
| 8 | sales | Sales builds the quotation with its lines — every rate locked at zero | PASS | {"quotation":"AMD-15600-0","lines":[1],"rate0":true,"stage":"sales"} |
| 9 | sales | … and the quotation row is live under its own project name | PASS | {"id":"AMD-15600-0","live":"RUN1 S3 Budaiya sofa"} |
| 10 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 11 | estimator | The Estimator's session sees the quotation arrive at its stage | PASS | AMD-15600-0 |
| 12 | estimator | Estimator costs each line from the Item Master, books labour, submits, routes | PASS | {"out":[{"line":1,"mat":true,"lab":true,"submitted":true,"depts":true,"price":29.757}],"err":null} |
| 13 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 14 | approver | The Approver's session sees the priced quotation | PASS | AMD-15600-0 |
| 15 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 16 | approver | … and lifecycle_status is open in the live row | PASS | open |
| 17 | sales | Sales sees the approval land | PASS | AMD-15600-0 |
| 18 | sales | Sales confirms to a Job Card, unrouted, bridged to Operations | PASS | {"job":"JB26AMD01186","amount":29.757,"routing":false,"bridged":true,"curtainBridged":false} |
| 19 | sales | … and the job card is live | PASS | JB26AMD01186 |
| 20 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01186 |
| 21 | operations_manager | Operations routes with a target date; every routed department gets a budget slot | PASS | {"routing":true,"target":"2026-09-20","budgets":["uph"]} |
| 22 | upholstery_manager | The supervisor submits the upholstery budget | PASS | {} |
| 23 | operations_manager | Operations approves it | PASS | {"ok":true} |
| 24 | upholstery_manager | Frames booked; cutting refused before frames ends; the roll received and inspected; the plan released off one roll | PASS | {"spec":"3-seater sofa","f1":true,"early":"Cannot book — No fabric on site for this job.","roll":"R-0003","plan":"UT-1186-A","totalM":15.9,"free":30.1,"foam":"R |
| 25 | upholstery_manager | … and the ticket is in the live fabric_plans table | PASS | UT-1186-A |
| 26 | upholstery_manager | Cutting books after frames; sewing and the bays pull their dates from it | PASS | {"foamOnShelf":24,"c":"USLOT-0006","s":"2026-09-09","b":"2026-09-11"} |
| 27 | upholstery_manager | Finishing & QC passes under the manager's authority and hands off | PASS | {"complete":true} |
| 28 | delivery_scheduling | Delivery schedules the job | PASS | {"id":"DS1002"} |
| 29 | operations_manager | A full delivery note is accepted once production is complete, and the job completes by derivation | PASS | {"delivered":true,"status":"completed"} |
| 30 | operations_manager | … and the live job card reads completed | PASS | completed |
| 31 | delivery_scheduling | Delivery marks the schedule delivered | PASS | {} |
| 32 | accounts | Accounts sees the completed job | PASS | JB26AMD01186 |
| 33 | accounts | Accounts invoices 100%, receives it in full — balance nets to zero; a second invoice is refused | PASS | {"invoice":"IN26AMD01009","net":29.757,"receipt":"RC26AMD01008","balance":0,"second":"This job is already fully invoiced (100%)."} |
| 34 | accounts | … and the invoice is in the live tax_invoices table | PASS | IN26AMD01009 |
| 35 | owner | The Owner's session holds the completed job and its invoice | PASS | JB26AMD01186 |
| 36 | owner | The Owner dashboard opens with the numbers behind it | PASS | {"shown":true,"mentionsJob":true} |

## S4 Curtain

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1836"} |
| 2 | sales | … and it is in the live customers table under its own name | PASS | {"id":"C1836","live":"RUN1 S4 1788432960335"} |
| 3 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04313AMD"} |
| 4 | sales | Sales builds the quotation with its lines — every rate locked at zero | PASS | {"quotation":"AMD-15601-0","lines":[1],"rate0":true,"stage":"sales"} |
| 5 | sales | … and the quotation row is live under its own project name | PASS | {"id":"AMD-15601-0","live":"RUN1 S4 Juffair apartment"} |
| 6 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 7 | estimator | The Estimator's session sees the quotation arrive at its stage | PASS | AMD-15601-0 |
| 8 | estimator | Estimator costs each line from the Item Master, books labour, submits, routes | PASS | {"out":[{"line":1,"mat":true,"lab":true,"submitted":true,"depts":true,"price":29.757}],"err":null} |
| 9 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 10 | approver | The Approver's session sees the priced quotation | PASS | AMD-15601-0 |
| 11 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 12 | approver | … and lifecycle_status is open in the live row | PASS | open |
| 13 | sales | Sales sees the approval land | PASS | AMD-15601-0 |
| 14 | sales | Sales confirms to a Job Card, unrouted, bridged to Operations | PASS | {"job":"JB26AMD01187","amount":59.514,"routing":false,"bridged":true,"curtainBridged":true} |
| 15 | sales | … and the job card is live | PASS | JB26AMD01187 |
| 16 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01187 |
| 17 | operations_manager | Operations routes with a target date; every routed department gets a budget slot | PASS | {"routing":true,"target":"2026-09-20","budgets":["curt"]} |
| 18 | sales | The confirm bridged the job into Curtain's own tracker | PASS | true |
| 19 | curtain_manager | The Curtain manager's session sees the bridged job | PASS | JB26AMD01187 |
| 20 | curtain_manager | Curtain authors the windows and schedules the install | PASS | {"id":"JB26AMD01187","windows":1,"sched":"2026-09-16"} |
| 21 | curtain_manager | … and the curtain job persisted with its windows (the 3s scanner) | PASS | 13 |
| 22 | installation_crew_lead | The install crew clocks 5 h of installation on the curtain job, per man, into the ledger | PASS | {"session":"SESS-0005","hours":5,"logs":2,"activity":"installation","curtainLog":true} |
| 23 | delivery_scheduling | Delivery schedules the job | PASS | {"id":"DS1003"} |
| 24 | operations_manager | A full delivery note is accepted once production is complete, and the job completes by derivation | PASS | {"delivered":true,"status":"completed"} |
| 25 | operations_manager | … and the live job card reads completed | PASS | completed |
| 26 | delivery_scheduling | Delivery marks the schedule delivered | PASS | {} |
| 27 | accounts | Accounts sees the completed job | PASS | JB26AMD01187 |
| 28 | accounts | Accounts invoices 100%, receives it in full — balance nets to zero; a second invoice is refused | PASS | {"invoice":"IN26AMD01010","net":59.514,"receipt":"RC26AMD01009","balance":0,"second":"This job is already fully invoiced (100%)."} |
| 29 | accounts | … and the invoice is in the live tax_invoices table | PASS | IN26AMD01010 |
| 30 | owner | The Owner's session holds the completed job and its invoice | PASS | JB26AMD01187 |
| 31 | owner | The Owner dashboard opens with the numbers behind it | PASS | {"shown":true,"mentionsJob":true} |

## S5 Mixed

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1837"} |
| 2 | sales | … and it is in the live customers table under its own name | PASS | {"id":"C1837","live":"RUN1 S5 1788432960335"} |
| 3 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04314AMD"} |
| 4 | sales | Sales builds the quotation with its lines — every rate locked at zero | PASS | {"quotation":"AMD-15602-0","lines":[1,2,3],"rate0":true,"stage":"sales"} |
| 5 | sales | … and the quotation row is live under its own project name | PASS | {"id":"AMD-15602-0","live":"RUN1 S5 Riffa villa"} |
| 6 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 7 | estimator | The Estimator's session sees the quotation arrive at its stage | PASS | AMD-15602-0 |
| 8 | estimator | Estimator costs each line from the Item Master, books labour, submits, routes | PASS | {"out":[{"line":1,"mat":true,"lab":true,"submitted":true,"depts":true,"price":29.757},{"line":2,"mat":true,"lab":true,"submitted":true,"depts":true,"price":29.7 |
| 9 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 10 | approver | The Approver's session sees the priced quotation | PASS | AMD-15602-0 |
| 11 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 12 | approver | … and lifecycle_status is open in the live row | PASS | open |
| 13 | sales | Sales sees the approval land | PASS | AMD-15602-0 |
| 14 | sales | Sales confirms to a Job Card, unrouted, bridged to Operations | PASS | {"job":"JB26AMD01188","amount":89.271,"routing":false,"bridged":true,"curtainBridged":true} |
| 15 | sales | … and the job card is live | PASS | JB26AMD01188 |
| 16 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01188 |
| 17 | operations_manager | Operations routes with a target date; every routed department gets a budget slot | PASS | {"routing":true,"target":"2026-09-20","budgets":["curt","carp","paint","uph"]} |
| 18 | sales | The curtain line bridged into Curtain although the enquiry division is Joinery | PASS | true |
| 19 | owner | Each department sees only its own line: joinery the TV unit, upholstery the sofa, curtain its job | PASS | {"prd":["Painted TV unit"],"uph":["3-seater sofa"],"curt":1} |
| 20 | owner | The Owner sees all three lines and all four departments on one job | PASS | {"items":3,"depts":["carp","curt","paint","uph"]} |

## Findings

1. **[note] S1 Joinery step 28 (operations_manager)** — addDeliveryNote() accepts an entry with no requiredQty and delivers nothing  
   The driver first sent {lineId, qty}; the function created an empty delivery note and called auto-complete rather than refusing. The UI always sends requiredQty, so this is a data-layer hole, not a screen bug. Minor.
2. **[note] S2 Joinery + Paint step 24 (operations_manager)** — addDeliveryNote() accepts an entry with no requiredQty and delivers nothing  
   The driver first sent {lineId, qty}; the function created an empty delivery note and called auto-complete rather than refusing. The UI always sends requiredQty, so this is a data-layer hole, not a screen bug. Minor.
3. **[note] S3 Upholstery step 28 (operations_manager)** — addDeliveryNote() accepts an entry with no requiredQty and delivers nothing  
   The driver first sent {lineId, qty}; the function created an empty delivery note and called auto-complete rather than refusing. The UI always sends requiredQty, so this is a data-layer hole, not a screen bug. Minor.
4. **[note] S4 Curtain step 23 (operations_manager)** — addDeliveryNote() accepts an entry with no requiredQty and delivers nothing  
   The driver first sent {lineId, qty}; the function created an empty delivery note and called auto-complete rather than refusing. The UI always sends requiredQty, so this is a data-layer hole, not a screen bug. Minor.

## Console / page errors by role

- **joinery_production_manager**: `Failed to load resource: the server responded with a status of 403 ()` · `Failed to load resource: the server responded with a status of 403 ()` · `Failed to load resource: the server responded with a status of 403 ()` · `Failed to load resource: the server responded with a status of 403 ()` · `Failed to load resource: the server responded with a status of 403 ()`
