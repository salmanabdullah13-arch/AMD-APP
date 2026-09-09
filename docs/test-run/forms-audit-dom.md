# Forms pass — the clicking half (every module, every rail page)

Generated 2026-09-08 20:26 by `forms-audit-dom.js` (offline, demo data). 66 screens walked.

## 1 · Selects that open pre-answered INSIDE a create form (2)

The rendered first option carries a real value and the card has a create/save action — whatever sorts first is what gets saved unless the person notices. This is the class of Salman's Unit-defaults-to-Box.

| Module | Page | id | Opens on | Action on the card |
|---|---|---|---|---|
| Sales | `openEnquiryCreate()` | `(no id)` | Arun Kumar | + New Customer |
| Accounts | `accountsSetView('ledger-new')` | `ac-lg-tax` | Taxable (10%) | Save Ledger |

## 2 · Selects pre-answered outside a create form (0)

Filters and pick-a-row selects — a default is usually right here. Listed for completeness.

## 3 · Horizontal overflow at 390px (0)

_None._

## 4 · Controls under 30px on a phone (34 screens)

| Module | Page | Count | Sample |
|---|---|---|---|
| Operations | `(landing)` | 7 | This week
      0
   312x20, Week 53x25, Month 59x25, ‹ 26x26, Today 50x26, › 26x26 |
| Operations | `opsStep('route')` | 7 | This week
      0
   312x20, Week 53x25, Month 59x25, ‹ 26x26, Today 50x26, › 26x26 |
| Purchaser | `purchGoTo('purch-requests')` | 5 | All 34x24, Carpentry 70x24, Painting 62x24, Upholstery 75x24, Metal Works 83x24 |
| Purchaser | `purchGoTo('purch-orders')` | 1 | 🖨 Print PO 57x15 |
| Purchaser | `purchGoTo('purch-suppliers')` | 1 | View 42x20 |
| Store | `(landing)` | 7 | This week
      0
   292x20, Week 54x22, Month 58x22, ‹ 26x26, Today 52x26, › 26x26 |
| Storekeeper (old stock pool) | `(landing)` | 2 | In-Pool 57x27, Release History 96x27 |
| Storekeeper (old stock pool) | `skGoTo('items')` | 207 | All Catelogs 288x19, Edit 37x20, Edit 37x20, Edit 37x20, Edit 37x20, Edit 37x20 |
| Upholstery | `(landing)` | 11 | ? What this page is  126x22, ? What this page is  126x22, This week 65x15, ? What this pag |
| Upholstery | `UphUI.go('page','reg')` | 2 | Upholstery 55x15, ? What this page is  126x22 |
| Upholstery | `UphUI.go('form','plan')` | 12 | Upholstery 55x15, Pricing input 91x28, Upholstery spec 107x28, Fabric plan 81x28, Foam sch |
| Upholstery | `UphUI.go('form','ot')` | 12 | Upholstery 55x15, Pricing input 91x28, Upholstery spec 107x28, Fabric plan 81x28, Foam sch |
| Sales | `(landing)` | 12 | All 36x27, Needs me 74x27, With Estimator 100x27, With Approver 99x27, With client 79x27,  |
| Sales | `openEnquiryCreate()` | 2 | ‹ Back to Enquiry Li 114x16, + New Customer 108x29 |
| Estimator | `(landing)` | 10 | This week
      0
   256x20, Week 53x25, Month 59x25, ‹ 26x26, Today 50x26, › 26x26 |
| Owner Dashboard | `(landing)` | 12 | Open Sales › 65x15, All › 21x15, Purchasing › 64x15, Quarterly 73x25, Running 68x25, This  |
| Admin Dashboard | `adminSetView('discounts')` | 7 | Save 30x16, Save 30x16, Save 30x16, Save 30x16, Save 30x16, Save 30x16 |
| Production | `(landing)` | 11 | ? What this page is  126x22, ? What this page is  126x22, This week 65x15, ? What this pag |
| Production | `PrdUI.go('page','mat')` | 2 | Production 55x15, ? What this page is  126x22 |
| Production | `PrdUI.go('page','team')` | 2 | Production 55x15, ? What this page is  126x22 |
| Production | `PrdUI.go('form','allot')` | 14 | Production 55x15, Pricing 60x28, Job BOM 71x28, BOM change 90x28, Reserve 64x28, Purchase  |
| Production | `PrdUI.go('form','cut')` | 14 | Production 55x15, Pricing 60x28, Job BOM 71x28, BOM change 90x28, Reserve 64x28, Purchase  |
| Production | `PrdUI.go('form','ot')` | 14 | Production 55x15, Pricing 60x28, Job BOM 71x28, BOM change 90x28, Reserve 64x28, Purchase  |
| Accounts | `accountsSetView('receipt-new')` | 3 | ‹ Back to General Re 141x16, + Add Row 76x22, Create Receipt 288x19 |
| Accounts | `accountsSetView('payment-new')` | 3 | ‹ Back to General Pa 149x16, + Add Row 76x22, Create Payment 288x19 |
| Accounts | `accountsSetView('journal-new')` | 3 | ‹ Back to Journal 91x16, + Add a new Row 108x22, Create Journal 288x19 |
| Accounts | `accountsSetView('ledger-new')` | 2 | ‹ Back to Ledgers 94x16, Save Ledger 288x19 |
| HR & Payroll | `hrSetView('payroll-runs')` | 1 | Create run 67x19 |
| Curtain – Tracks Team | `(landing)` | 10 | Abdullah 69x20, Prince 56x20, Abdullah 69x20, Prince 56x20, Abdullah 69x20, Prince 56x20 |
| Curtain – QC Team | `(landing)` | 1 | Switch 35x12 |
| Upholstery – Team Leader | `(landing)` | 2 | Upholstery 55x15, ? What this page is  126x22 |
| Upholstery – QC/Packaging | `(landing)` | 2 | Upholstery 55x15, ? What this page is  126x22 |
| Vehicle Fleet Inspector | `(landing)` | 1 | + Add Vehicle 99x29 |
| Delivery / Scheduling | `(landing)` | 8 | Schedule → 80x29, Schedule → 80x29, Schedule → 80x29, Schedule → 80x29, Schedule → 80x29,  |

## 5 · Number inputs with no min (2)

A negative quantity or rate saves silently.

| Module | id |
|---|---|
| Accounts | `ac-lg-opening` |
| HR & Payroll | `prun-year` |

## Screens that would not open

- Operations `opsGoTo('projects')` — view: Cannot read properties of undefined (reading 'length')
- Curtain & Blinds `curtGoTo('curt-install')` — view: Cannot read properties of undefined (reading 'length')

Page errors during the walk: 0