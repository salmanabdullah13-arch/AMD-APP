# Dead-control sweep — every control on every screen, clicked

Generated 2026-09-06 19:43 by `dead-control-sweep.js` (offline, demo data). 688 controls clicked.

A control passes if ANYTHING happened: the body changed, a toast or dialog appeared, the view moved, a print opened a tab, or another module took over. Destructive controls (sign out, delete, remove, cancel, purge, clear) are never clicked.

## Controls where nothing happened (90)

| Module | Page | Control | Handler |
|---|---|---|---|
| Curtain & Blinds | `(landing)` | Material overage 0 jobs over quote estim | `curtGoTo('curt-bom')` |
| Curtain & Blinds | `(landing)` | Arrived, unreceived 0 in Bahrain, awaiti | `curtGoTo('curt-fabric')` |
| Curtain & Blinds | `(landing)` | Al Fardan Villa 4 — Curtains JB26AMD0100 | `curtOpenJobFromDash('JB26AMD01004')` |
| Curtain & Blinds | `curtGoTo('curt-jobs')` | Al Fardan Villa 4 — Curtains JB26AMD0100 | `curtOpenJob('JB26AMD01004')` |
| Curtain & Blinds | `curtGoTo('curt-fabric')` | + Raise Purchase Request | `openRaiseInquirySheet()` |
| Purchaser | `purchGoTo('purch-requests')` | All | `purchSetPRFilter('all')` |
| Purchaser | `purchGoTo('purch-requests')` | Painting | `purchSetPRFilter('paint')` |
| Storekeeper | `(landing)` | In-Pool | `skSetView('pool')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003516')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003508')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003501')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003499')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003498')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003489')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003473')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003465')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003460')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003435')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003432')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003400')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003387')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003386')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003376')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003372')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003368')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003365')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003364')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003363')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003360')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003345')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003332')` |
| Storekeeper | `skGoTo('items')` | Edit | `openItemForm('IT003331')` |
| Storekeeper | `skGoTo('masters')` | Unit | `skSetMastersTab('unit')` |
| Storekeeper | `skGoTo('reports')` | Stock Report | `skSetReportsTab('stock')` |
| Upholstery | `(landing)` | This week | `wk-today` |
| Upholstery | `(landing)` | My tasks 0 ⌄ | `plToggleTasks()` |
| Upholstery | `UphUI.go('page','reg')` | All stages 2 | `chip` |
| Sales | `(landing)` | › | `plStepPeriod(1)` |
| Sales | `(landing)` | Thu 03 | `plSelectDay('2026-09-03')` |
| Sales | `(landing)` | Fri 04 | `plSelectDay('2026-09-04')` |
| Sales | `(landing)` | Sat 05 | `plSelectDay('2026-09-05')` |
| Sales | `(landing)` | ＋ Add to this day | `plAddPlannerEvent()` |
| Sales | `(landing)` | My tasks 0 ⌄ | `plToggleTasks()` |
| Sales | `(landing)` | All | `stage` |
| Sales | `(landing)` | Needs me | `stage` |
| Sales | `(landing)` | With Estimator | `stage` |
| Estimator | `(landing)` | Queue | `go` |
| Estimator | `(landing)` | Quote | `go` |
| Estimator | `(landing)` | Items | `go` |
| Estimator | `(landing)` | BOM | `go` |
| Estimator | `(landing)` | Roll-up | `go` |
| Estimator | `(landing)` | 1Alleverything on my desk› | `qfilter` |
| Estimator | `(landing)` | 1Awaiting costingno estimator has picked | `qfilter` |
| Estimator | `(landing)` | My tasks 0 ⌃ | `plToggleTasks()` |
| Estimator | `(landing)` | ≡ Operations 0 › | `plSetTaskFilter('ops')` |
| Estimator | `(landing)` | ≡ Sales 0 › | `plSetTaskFilter('sales')` |
| Estimator | `(landing)` | ≡ Accounts 0 › | `plSetTaskFilter('accounts')` |
| Estimator | `(landing)` | ≡ Site visits 0 › | `plSetTaskFilter('site')` |
| Estimator | `(landing)` | ＋ Add list | `plAddTaskList()` |
| Estimator | `(landing)` | All › | `go` |
| Estimator | `(landing)` | Rate library › | `go` |
| Estimator | `(landing)` | Pick | `pick` |
| Estimator | `(landing)` | ⇄ | `deleg` |
| Owner Dashboard | `(landing)` | ‹ | `plStepPeriod(-1)` |
| Owner Dashboard | `(landing)` | 08 | `plSelectDay('2026-09-08')` |
| Admin Dashboard | `adminSetView('discounts')` | Save | `adminSaveDiscountLimit('role','sales')` |
| Admin Dashboard | `adminSetView('discounts')` | Save | `adminSaveDiscountLimit('role','estimator')` |
| Admin Dashboard | `adminSetView('discounts')` | Save | `adminSaveDiscountLimit('role','approver')` |
| Admin Dashboard | `adminSetView('discounts')` | Save | `adminSaveDiscountLimit('role','operations_manager')` |
| Admin Dashboard | `adminSetView('discounts')` | Save | `adminSaveDiscountLimit('role','owner')` |
| Admin Dashboard | `adminSetView('discounts')` | Save | `adminSaveDiscountLimit('role','admin')` |
| Production | `(landing)` | This week | `wk-today` |
| Production | `(landing)` | This week 0 ⌄ | `plTogglePlanner()` |
| Production | `(landing)` | My tasks 0 ⌄ | `plToggleTasks()` |
| Production | `PrdUI.go('page','mat')` | All 0 | `chip` |
| Production | `PrdUI.go('page','mat')` | Short 0 | `chip` |
| Production | `PrdUI.go('page','mat')` | Held 0 | `chip` |
| Production | `PrdUI.go('page','cut')` | All 1 | `chip` |
| Production | `PrdUI.go('page','cut')` | Dead 1 | `chip` |
| Approver | `(landing)` | 0For Approval | `approverToggleTile('forApproval')` |
| Curtain – Tracks Team | `(landing)` | My Queue (5) | `tracksDashView='queue';renderTracksDashboard()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – QC Team | `(landing)` | Queue | `qcSetView('queue')` |
| Curtain – QC Team | `(landing)` | Switch | `qcSwitchUser()` |
| Upholstery – Team Leader | `(landing)` | All stages 2 | `chip` |
| Upholstery – QC/Packaging | `(landing)` | All 2 | `chip` |

## Controls that threw (5)

| Module | Page | Control | Error |
|---|---|---|---|
| Curtain & Blinds | `curtGoTo('curt-bom')` | Al Fardan Villa 1 — Curtains JB26AMD0100 | Cannot read properties of undefined (reading 'accessories') |
| Curtain & Blinds | `curtGoTo('curt-bom')` | Al Fardan Villa 2 — Curtains JB26AMD0100 | Cannot read properties of undefined (reading 'accessories') |
| Curtain & Blinds | `curtGoTo('curt-bom')` | Al Fardan Villa 3 — Curtains JB26AMD0100 | Cannot read properties of undefined (reading 'accessories') |
| Curtain & Blinds | `curtGoTo('curt-bom')` | Al Fardan Villa 4 — Curtains JB26AMD0100 | Cannot read properties of undefined (reading 'accessories') |
| Storekeeper | `skGoTo('reports')` | 🖨 Print item history | Cannot read properties of undefined (reading 'length') |