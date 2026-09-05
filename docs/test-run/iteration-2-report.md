# End-to-end run — iteration 2 (exception branches)

Run 2026-09-05 12:15 · 220/221 checks passed · 356 s · manifest test-run/iter2-manifest.json

## X1 Sent back for re-costing

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1832"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04308AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15596-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15596-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15596-0 |
| 9 | approver | The Approver sends the quote back to the Estimator, with an audit entry | PASS | {"stage":"estimator","audit":{"seq":4,"action":"Transfer","user":"E2E Approver Role Account","date":"2026-09-05","userType":"ESTIMATOR","status":"Draft"}} |
| 10 | estimator | It lands back in the Estimator's queue | PASS | AMD-15596-0 |
| 11 | estimator | The Estimator re-costs and transfers again | PASS | {"stage":"approver"} |
| 12 | approver | … and this time it is approved | PASS | {"lc":"open"} |

## X2 Over BD 8,000

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1833"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04309AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15597-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15597-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":2485.665}],"total":24856.65} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15597-0 |
| 9 | estimator | The quote is worth more than BD 8,000 | PASS | 24856.65 |
| 10 | operations_manager | Operations can only RECOMMEND — the quote waits for the Owner | PASS | {"lc":"draft","owner":"pending-owner-review","by":"E2E Operations Account"} |
| 11 | operations_manager | … and the recommendation survives in the live row | PASS | pending-owner-review |
| 12 | sales | Sales cannot confirm a Job Card before the Owner signs | PASS | Quotation must be Open before it can be confirmed. |
| 13 | owner | The Owner's session sees it in Sign-offs | PASS | AMD-15597-0 |
| 14 | owner | The Owner counter-signs — lifecycle open | PASS | {"lc":"open","owner":null} |
| 15 | sales | … and Sales can now confirm it | PASS | JB26AMD01181 |

## X3 Discount over 30%

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1834"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04310AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15598-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15598-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | A 40% discount is refused, or routed to the Approver, at the DATA layer | **FAIL** | {"pct":40,"base":59.514} |

## X4 Variation order

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1835"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04311AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15599-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15599-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15599-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15599-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01182","amount":59.514} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01182 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | sales | The confirmed quotation is frozen — no new line, no stage move | PASS | {"add":"This quote is confirmed into Job Card JB26AMD01182 — its items and pricing are frozen. Raise a Variation on the Job Card to change the work.","transfer" |
| 18 | sales | Sales raises a variation on the live job | PASS | {"vq":"AMD-15599-1","parent":"JB26AMD01182","rev":1,"line":1} |
| 19 | estimator | The variation goes through the Estimator like any quotation | PASS | {} |
| 20 | approver | … and the Approver | PASS | {} |
| 21 | sales | Sales sees the variation approved | PASS | AMD-15599-1 |
| 22 | sales | Confirming merges onto the SAME job — one more line, tagged with the variation, no second job card | PASS | {"items":2,"before":1,"jobs":0,"uphBudget":true,"tagged":true} |
| 23 | sales | The new department gets a budget slot (Fix Plan Phase 1) | PASS | {"items":2,"before":1,"jobs":0,"uphBudget":true,"tagged":true} |
| 24 | sales | … and the live job card carries the merged line | PASS | 2 |

## X5 BOM revision mid-cut

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1836"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04312AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15600-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15600-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15600-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15600-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01183","amount":59.514} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01183 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | joinery_production_manager | A cutting list is released and on saw 1 | PASS | {"sheet":"CUT-0001","status":"on-saw"} |
| 18 | joinery_production_manager | Issuing the revision kills the sheet on the saw, and the lane refuses the job | PASS | {"dead":"dead","killedBy":"REV-0024","block":"Old cutting list still on the saw — confirm it off before recutting"} |
| 19 | joinery_production_manager | Confirming the sheet off the saw clears the gate — not the revision | PASS | {"block":null} |
| 20 | joinery_production_manager | … and the dead sheet's state is in the live table | PASS | dead |

## X6 Material short at the lane

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1837"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04313AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15601-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15601-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":36.855000000000004}],"total":73.71000000000001} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15601-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15601-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01184","amount":73.71000000000001} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01184 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | joinery_production_manager | The lane refuses the job for short material, and the waiting strip carries the reason | PASS | {"err":"No lane slot: Material short — 1 line. It stays in the waiting strip until that clears.","waiting":"Material short — 1 line"} |
| 18 | storekeeper | The store puts the boards on the shelf | PASS | {"free":20,"item":"IT003422"} |
| 19 | joinery_production_manager | Production's session sees the stock arrive | PASS | null |
| 20 | joinery_production_manager | Now the lane takes it, and the slot claims the boards for the job | PASS | {"slot":"SLOT-0046","held":1} |

## X7 Overtime

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1838"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04314AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15602-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15602-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":50.504999999999995}],"total":101.00999999999999} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15602-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15602-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01185","amount":101.00999999999999} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01185 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | joinery_production_manager | No cause: refused. A job with short material and no lane: refused AND recorded | PASS | {"noCause":"The cause of the slip is required — one of: BOM revision late · Material late · Client change.","idle":"Refused — nothing to work on. The material i |
| 18 | upholstery_manager | Upholstery's own overtime refuses an idle stage the same way | PASS | {"err":"Refused — nothing to work on. Nothing on this job card is routed to upholstery. — overtime cannot fix that."} |

## X8 QC fail and rework

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1839"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04315AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15603-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15603-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15603-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15603-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01186","amount":59.514} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01186 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | joinery_production_manager | A pass from the wrong identity is refused; a fail from the manager sends it to rework with its reason | PASS | {"rogue":"A QC pass at Carpentry must be recorded by the Joinery Production Manager.","status":"rework","reason":"Veneer lifted on the door","count":1,"inQueue" |
| 18 | joinery_production_manager | … and the reject reason is in the live job card | PASS | {"status":"rework","department":"carp","reworkCount":1,"rejectReason":"Veneer lifted on the door","joinerySubStage":"assembly"} |
| 19 | joinery_production_manager | Rework, second QC pass, hand-off — done at 100%, and the stale reason cleared | PASS | {"status":"done","pct":100,"reason":null} |

## X9 Cancel and un-cancel

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1840"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04316AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15604-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15604-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15604-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15604-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01187","amount":59.514} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01187 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | operations_manager | Cancelled: delivery, variation and invoice all refused; the quotation unfreezes for correction | PASS | {"status":"cancelled","dn":"This job is cancelled.","v":"This job is cancelled — a Variation can't be added to it.","inv":"This job is cancelled.","unfrozen":tr |
| 18 | operations_manager | … and the live job card reads cancelled | PASS | cancelled |
| 19 | joinery_production_manager | The cancelled job drops out of the production queue | PASS | {"inQueue":false,"inRouting":false} |
| 20 | operations_manager | Un-cancelling re-locks the quotation and puts the line back in the queue | PASS | {"status":"open","frozen":true,"inQueue":true} |

## X10 Partial delivery and invoice

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1841"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04317AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15605-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15605-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15605-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15605-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01188","amount":59.514} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01188 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | joinery_production_manager | Production finishes the line | PASS | {"done":"done"} |
| 18 | operations_manager | One of two delivered — the job stays open | PASS | {"delivered":1,"status":"open"} |
| 19 | accounts | Two 50% invoices stack to exactly 100%; a third is refused | PASS | {"a":"IN26AMD01000","b":"IN26AMD01001","c":"This job is already fully invoiced (100%).","sum":100} |
| 20 | operations_manager | The second delivery completes the job by derivation; a third is refused — nothing left to deliver | PASS | {"delivered":2,"status":"completed","over":{"error":"Nothing on this note is left to deliver — every line is already delivered in full."}} |

## X11 Near-duplicate customer

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | The same phone number flags a possible duplicate, pending, and Sales can still raise an enquiry on it | PASS | {"a":"C1842","b":"C1843","flagged":true,"status":"pending","enquiry":"ENQ04318AMD"} |
| 2 | accounts | Accounts' session sees the flagged customer arrive through realtime | PASS | C1843 |
| 3 | accounts | Accounts approves it | PASS | {"status":"approved"} |
| 4 | accounts | … and the live row reads approved | PASS | approved |

## X12 COM shortfall, X13 two lots

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1844"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04319AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15606-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15606-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":238.056} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15606-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15606-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01189","amount":238.056} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01189 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["uph"]} |
| 14 | upholstery_manager | A COM roll short of need blocks the table; the plan refuses; a client signature alone is not enough; the countersignature clears it | PASS | {"need":10,"block":"COM roll 6 m short. Signed note before anyone cuts.","plan":"COM. We cannot buy more. Nobody cuts until the shortfall is signed. (COM roll 6 |
| 15 | upholstery_manager | … and the signed note is in the live table with both names | PASS | {"c":"Client","s":"E2E Test Account"} |
| 16 | upholstery_manager | Two rolls of 60% of the need each: the plan refuses BOTH — the suite does not come off one roll | PASS | {"need":10,"p1":"Cannot release — 10 m needed, 6 m on R-0002. The suite does not come off one roll, and a second lot on one suite is scrap.","p2":"Cannot releas |

## X14 Crew clock refusals

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1845"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04320AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15607-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15607-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":59.514} |
| 7 | estimator | Estimator transfers to the Approver | PASS | {"stage":"approver"} |
| 8 | approver | The Approver sees the priced quotation | PASS | AMD-15607-0 |
| 9 | approver | Approver approves — lifecycle open, back to Sales | PASS | {"lifecycle":"open","stage":"sales"} |
| 10 | sales | Sales sees the approval land | PASS | AMD-15607-0 |
| 11 | sales | Sales confirms to a Job Card | PASS | {"job":"JB26AMD01190","amount":59.514} |
| 12 | operations_manager | Operations sees the job in its routing queue | PASS | JB26AMD01190 |
| 13 | operations_manager | Operations routes; every department gets a budget slot | PASS | {"routing":true,"budgets":["carp"]} |
| 14 | joinery_production_manager | Production submits the joinery budget | PASS | {} |
| 15 | operations_manager | Operations approves the joinery budget | PASS | ["carp:ok"] |
| 16 | joinery_production_manager | Production starts the line | PASS | {"status":"in-production"} |
| 17 | installation_crew_lead | A second clock is refused; a pause with no reason is refused; 100% is refused before the day ends; a day ends once | PASS | {"s1":"SESS-0001","s2":"Joinery · Crew A is already on the clock (JB26AMD01190, since 12:15). End that first.","p":"Why is the clock stopping? One of: Waiting o |
| 18 | installation_crew_lead | … and the ended session is in the live table with its pause | PASS | {"status":"ended","pauses":1} |

## X15 Delegated estimate

| # | Role | Step | Result | Detail |
|---|---|---|---|---|
| 1 | sales | Sales creates the customer | PASS | {"customer":"C1846"} |
| 2 | sales | Sales creates the enquiry | PASS | {"enquiry":"ENQ04321AMD"} |
| 3 | sales | Sales builds the quotation — every rate locked at zero | PASS | {"quotation":"AMD-15608-0","lines":[1],"rate0":true} |
| 4 | sales | Sales transfers to the Estimator | PASS | {"stage":"estimator"} |
| 5 | estimator | The Estimator sees it arrive | PASS | AMD-15608-0 |
| 6 | estimator | Estimator costs, books labour, submits, routes | PASS | {"out":[{"line":1,"ok":true,"price":29.757}],"total":29.757} |
| 7 | estimator | Delegating to oneself is refused; delegating to Arun re-assigns the quote with an audit entry | PASS | {"bad":"Pick a different estimator to delegate to.","picked":"Arun Kumar A","audit":"Delegated from Arun Kumar A to Arun Kumar A — tender, closes Thursday"} |
| 8 | estimator | … and the delegate is in the live row | PASS | Arun Kumar A |

## Findings and notes

1. **[design] X3 Discount over 30% step 7 (estimator)** — A 40% discount is refused, or routed to the Approver, at the DATA layer  
   {"pct":40,"base":59.514}
2. **[finding] X3 Discount over 30% step 7 (estimator)** — The 30% discount ceiling lives only in the Estimator screen; setQuoteDiscount() applied 40% without a gate  
   The 6a package routes a discount over 30% to the Approver. The data layer has no such rule, so the raw API, the Excel round-trip and any future screen can apply any discount. Server-side the pricing-lock trigger covers Sales only.
3. **[finding] X15 Delegated estimate step 7 (estimator)** — delegateQuotation() accepts a delegation with no reason  
   The 13b Operations widget refuses a delegation without a reason; the data-layer function does not. Minor inconsistency.

## Console / page errors and refused writes by role

- **estimator**: `HTTP 409 POST /rest/v1/messages?select=*` · `Failed to load resource: the server responded with a status of 409 ()` · `HTTP 409 POST /rest/v1/messages?select=*` · `Failed to load resource: the server responded with a status of 409 ()`
- **operations_manager**: `HTTP 409 POST /rest/v1/messages?select=*` · `Failed to load resource: the server responded with a status of 409 ()`
