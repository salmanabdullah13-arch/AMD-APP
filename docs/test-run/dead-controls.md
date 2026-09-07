# Dead-control sweep — every control on every screen, clicked

Generated 2026-09-07 09:50 by `dead-control-sweep.js` (offline, demo data). 695 controls clicked.

A control passes if ANYTHING happened: the body changed, a toast or dialog appeared, the view moved, a print opened a tab, or another module took over. Destructive controls (sign out, delete, remove, cancel, purge, clear) are never clicked.

## Controls where nothing happened (15)

| Module | Page | Control | Handler |
|---|---|---|---|
| Store | `(landing)` | My tasks 0 ⌄ | `plToggleTasks()` |
| Upholstery | `(landing)` | This week | `wk-today` |
| Sales | `(landing)` | My tasks 0 ⌃ | `plToggleTasks()` |
| Estimator | `(landing)` | Queue | `go` |
| Estimator | `(landing)` | Quote | `go` |
| Estimator | `(landing)` | Items | `go` |
| Estimator | `(landing)` | BOM | `go` |
| Estimator | `(landing)` | Roll-up | `go` |
| Estimator | `(landing)` | 1Alleverything on my desk› | `qfilter` |
| Estimator | `(landing)` | 1Awaiting costingno estimator has picked | `qfilter` |
| Production | `(landing)` | This week | `wk-today` |
| Curtain – Tracks Team | `(landing)` | My Queue (5) | `tracksDashView='queue';renderTracksDashboard()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – Tracks Team | `(landing)` | Assigned: Abdullah Prince — unassigned M | `event.stopPropagation()` |
| Curtain – QC Team | `(landing)` | Switch | `qcSwitchUser()` |

## Controls that threw (1)

| Module | Page | Control | Error |
|---|---|---|---|
| Storekeeper (old stock pool) | `skGoTo('reports')` | 🖨 Print item history | Cannot read properties of undefined (reading 'length')  [at key (file:///C:/Users/salma/Documents/Projects/AMD-APP/store |