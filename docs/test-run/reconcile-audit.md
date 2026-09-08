# Reconciliation audit — the same number, computed every way

Generated 2026-09-08 17:43 by `reconcile-audit.js`.

One real lifecycle is seeded offline — VAT, a quote-level discount, a part
payment, a credit note, a supplier invoice part-paid, stock in and out —
and then every group of figures that must agree is compared to the fils.
The iterations assert each step as it happens; this asserts that every
screen showing a figure shows the same figure.

## Result

**2 of 20 comparisons disagree.**

| Group | What | Figures | Spread |
|---|---|---|---|
| receivables | every customer Statement of Account closes to the same total | statements 1411.590<br>accountsKPI 1436.590 | 25.000 |
| revenue | Accounts' monthly chart totals to its own invoiced-revenue figure | chart 0.000<br>kpi 1536.590 | 1536.590 |

## Every comparison

| Group | What | Figures |
|---|---|---|
| receivables | the Accounts band, the Balance Sheet and invoiceBalance agree | accountsKPI 1436.590 · balanceSheet 1436.590 · invoiceBalances 1436.590 |
| receivables | Sales' own receivables figure agrees with Accounts' | salesKPI 1436.590 · accountsKPI 1436.590 |
| receivables | Sales Bill Outstanding totals to the same figure | billOutstanding 1436.590 · accountsKPI 1436.590 |
| receivables | **every customer Statement of Account closes to the same total** | statements 1411.590 · accountsKPI 1436.590 |
| receivables | Project Outstanding totals to the same figure | projectOutstanding 1436.590 · accountsKPI 1436.590 |
| payables | the Accounts band and the Balance Sheet agree | accountsKPI 0.000 · balanceSheet 0.000 |
| payables | Purchase Bill Outstanding totals to the same figure | billOutstanding 0.000 · accountsKPI 0.000 |
| payables | every supplier Statement of Account closes to the same total | statements 0.000 · accountsKPI 0.000 |
| job value | the job, its quotation and the Operations rollup agree | jobAmount 1536.590 · quotationNet 1536.590 · projectVal 1536.590 |
| job value | the Job report shows the same figure | jobReport 1536.590 · jobAmount 1536.590 |
| job value | and it is the sum of its own lines | itemsSum 1536.590 · jobAmount 1536.590 |
| invoice | a 100% invoice bills the job's own value | invoiceNet 1536.590 · jobAmount 1536.590 |
| invoice | its balance is the net less what was received and credited | balance 1436.590 · computed 1436.590 |
| actual cost | the job total is the sum of its lines | whole 0.000 · lines 0.000 |
| stock | the item total is the sum over its bins | itemTotal 18.000 · allBins 18.000 |
| stock | and the sum of its lots | lots 18.000 · itemTotal 18.000 |
| stock | free plus held is what is on hand in that bin | onHand 18.000 · freePlusHeld 18.000 |
| consumption | consumption value equals the cost ledger's material figure | consumption 0.000 · ledgerMaterials 0.000 |
| revenue | **Accounts' monthly chart totals to its own invoiced-revenue figure** | chart 0.000 · kpi 1536.590 |

## Figures that are supposed to differ

- **Accounts monthly revenue** vs **dashboard monthly revenue** — Accounts recognises revenue when it is INVOICED (taxInvoices); the Owner and Sales dashboards count it when the job is CONFIRMED. A real accounting distinction, recorded when the Batch 6 reports were built.
- **Job report materials** vs **material consumption value** — The Job report counts material MOVES, not a currency value — this app's issue/return moves carried no rate until the cost ledger, and the report says so in its own text.