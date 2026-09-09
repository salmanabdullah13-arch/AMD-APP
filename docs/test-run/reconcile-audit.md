# Reconciliation audit — the same number, computed every way

Generated 2026-09-09 09:04 by `reconcile-audit.js`.

One real lifecycle is seeded offline — VAT, a quote-level discount, a part
payment, a credit note, a supplier invoice part-paid, stock in and out —
and then every group of figures that must agree is compared to the fils.
The iterations assert each step as it happens; this asserts that every
screen showing a figure shows the same figure.

## Result

**All reconciled** — 22 comparisons.

## Every comparison

| Group | What | Figures |
|---|---|---|
| receivables | the Accounts band, the Balance Sheet and invoiceBalance agree | accountsKPI 1411.590 · balanceSheet 1411.590 · invoiceBalances 1411.590 |
| receivables | Sales' own receivables figure agrees with Accounts' | salesKPI 1411.590 · accountsKPI 1411.590 |
| receivables | Sales Bill Outstanding totals to the same figure | billOutstanding 1411.590 · accountsKPI 1411.590 |
| receivables | every customer Statement of Account closes to the same total | statements 1411.590 · accountsKPI 1411.590 |
| receivables | Project Outstanding totals to the same figure | projectOutstanding 1411.590 · accountsKPI 1411.590 |
| payables | the Accounts band and the Balance Sheet agree | accountsKPI 0.000 · balanceSheet 0.000 |
| payables | Purchase Bill Outstanding totals to the same figure | billOutstanding 0.000 · accountsKPI 0.000 |
| payables | every supplier Statement of Account closes to the same total | statements 0.000 · accountsKPI 0.000 |
| job value | the job, its quotation and the Operations rollup agree | jobAmount 1536.590 · quotationNet 1536.590 · projectVal 1536.590 |
| job value | the Job report shows the same figure | jobReport 1536.590 · jobAmount 1536.590 |
| job value | and it is the sum of its own lines | itemsSum 1536.590 · jobAmount 1536.590 |
| invoice | a 100% invoice bills the job's own value | invoiceNet 1536.590 · jobAmount 1536.590 |
| invoice | its balance is the net less what was received and credited | balance 1411.590 · computed 1411.590 |
| actual cost | the job total is its lines, what carried no line, and what was bought for it | whole 50.400 · parts 50.400 |
| actual cost | and every fils of it is attributable to a product | unallocated 0.000 · none 0.000 |
| actual cost | Operations' running actuals are the cost ledger's own figure | operationsRollup 50.400 · costLedger 50.400 |
| stock | the item total is the sum over its bins | itemTotal 18.000 · allBins 18.000 |
| stock | and the sum of its lots | lots 18.000 · itemTotal 18.000 |
| stock | free plus held is what is on hand in that bin | onHand 18.000 · freePlusHeld 18.000 |
| consumption | consumption value equals the cost ledger's material figure | consumption 50.400 · ledgerMaterials 50.400 |
| revenue | Accounts' monthly chart totals to its own invoiced-revenue figure | chart 1536.590 · kpi 1536.590 |

## Figures that are supposed to differ

- **Accounts monthly revenue** vs **dashboard monthly revenue** — Accounts recognises revenue when it is INVOICED (taxInvoices); the Owner and Sales dashboards count it when the job is CONFIRMED. A real accounting distinction, recorded when the Batch 6 reports were built.
- **Job report materials** vs **material consumption value** — The Job report counts material MOVES, not a currency value — this app's issue/return moves carried no rate until the cost ledger, and the report says so in its own text.