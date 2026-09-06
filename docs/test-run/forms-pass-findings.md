# The forms pass — every screen, the way a person meets it (6 Sep 2026)

Salman's own ten minutes on the quotation wizard found five defects that
four scripted iterations had missed. Every one was the same kind: the
screen, not the flow. The iterations drive the data layer as each role;
they never sit in a form and use it. This pass does, across every module.

Two harnesses, both committed and re-runnable:

- **`forms-audit-static.js`** reads the source for two classes: a
  data-layer function that can `return {error}` called from a screen with
  its result thrown away, and a `<select>` whose markup opens on a real
  value.
- **`forms-audit-dom.js`** opens every module and every page on its rail
  with demo data, at 1280 and 390, and measures what actually renders:
  selects that open pre-answered *inside a create form*, horizontal
  overflow, controls under 30px, number inputs with no floor.

`e2e-forms-pass.js` (11/11) locks in every fix and asserts both harnesses
still read zero, so the class cannot come back quietly.

## Fixed

**Seven refusals the screen was throwing away.** A guard fires, the
function returns `{error}`, and the screen redraws as though nothing
happened — exactly how "images don't save" looked. Every instance:
removing a line from a confirmed quotation (the ✕ did nothing and said
nothing), the Estimator's overhead, profit and selling-price override on a
frozen quote, clearing a discount limit, completing a job task, and
releasing a fabric hold.

**Four fields that became a record while pre-answered.** Salman's rule
from the Unit, applied where a wrong value is expensive and easy to miss:

- A **Purchase Request** opened on Division "Curtain & Blinds",
  Department "Carpentry" and Destination **"Stock (shared pool)"** — a
  job's material silently filed to the pool is expensive to unpick. All
  three now open unanswered and are refused at save.
- A **new enquiry** opened on Division "Curtain & Blinds" and the first
  Source. The division drives department routing and revenue attribution
  downstream; it is chosen now, and so is the source.

**A Journal that balanced on two negatives.** Debit −100 against Credit
−100 balances and means nothing. Receipts and payments already refused a
non-positive amount; the Journal did not. **My first version of this fix
was dead code** — it guarded `debit`/`credit` while the app's lines carry
`dr`/`cr`, so it would never have fired on a real journal. The suite
caught it.

**Twelve amount fields** on the Accounts vouchers, and every number field
in Production and Upholstery, now carry a floor of zero. The ledger's
opening balance is deliberately left unbounded — a credit-side opening is
legitimately negative.

## Left alone, on purpose

- **A new ledger's tax treatment** opens on "Taxable (10%)". That is the
  norm here and the ledger master is Accounts' own screen. Say the word
  and it becomes a choice like the others.
- **The enquiry's salesperson** reads as pre-answered only because the
  value is correct by construction: it is the signed-in person.
- **Thirty-three screens carry controls under 30px** — filter chips, tab
  strips, inline ✎ ⧉ ✕ icons, and the legacy Storekeeper list's per-row
  "Edit" at 37×20. Most are the design packages' own geometry, which you
  approved; resizing them app-wide is a design decision, not a bug fix, so
  it is reported rather than swept. The one I would change first is the
  Storekeeper list, which is the legacy screen the 18a build replaces
  anyway.

## Still open from before this pass

The **18a Store Keeper interface** (never built) and the **Approver's
landing** (counts where the queue should be).
