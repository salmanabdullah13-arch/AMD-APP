# Handoff: Upholstery (20a) + Production (22a–22d)

Two roles, one package, because they share a shell. Build the shell once.

## What is in here

| File | What it covers |
|---|---|
| `20a-upholstery-supervisor.md` | The upholstery supervisor's whole module — dashboard, twelve pages, ten create flows, the fabric-plan builder, the A4 cutting & sewing ticket |
| `22-production-module.md` | The joinery production manager's module — the live dashboard (22a), the badge change (22b), twelve pages and twelve flows (22c), the BOM editor (22d) |
| `22b-badges-code.md` | The exact `production-ui.js` edits for the 22b badge change — copy these literally |
| `AMD Dashboard Directions.dc.html` | The prototype canvas. `#20a` and `#22a`–`#22d` are the sections this package specifies |
| `support.js` | The runtime the canvas loads |

Drop the HTML and `support.js` in the same folder and open the HTML in a
browser. No build step, no network, no install.

## Read in this order

1. This file — the contract and what the two modules share.
2. `22-production-module.md` — Production is **already in code**, so it is a
   set of corrections and two additions, not a from-scratch build. Start here
   because it is the smaller job.
3. `20a-upholstery-supervisor.md` — Upholstery is a from-scratch build on the
   same shell.

---

## ⛔ The design is fixed

**Do not redesign, restyle, re-lay-out, simplify or "improve" anything in this
package.** Every px, hex, column width, font size and gap is a decision that
was made deliberately, reviewed and signed off. Reproduce it; do not interpret
it.

This has gone wrong before. What comes back is recognisably "the same screen"
but with different spacing, a different card order, a component library's
default button instead of the specified one, a table turned into cards, a
sidebar turned into tabs. That is a failure even when it looks fine in
isolation, because the result no longer matches the other nineteen modules.

1. **Layout is frozen.** Column widths, card order, which column a card sits
   in, the number of columns, what is above what. If a card is specified in the
   300px right rail, it goes in the 300px right rail.
2. **Spacing, radii, type sizes and weights are frozen.** Do not round 12.5px
   to 12px, do not swap 650 for 600, do not substitute a 4/8pt scale.
3. **Colour is frozen.** Wine `#600131` is the only brand accent. No second
   brand colour, no purple tint, no replacing the semantic red/amber/green.
4. **Copy is frozen.** Every label, subtitle, empty state, refusal and helper
   sentence is final. If a sentence seems odd, it is deliberate — it encodes a
   business rule.
5. **Component substitution needs permission.** If the codebase has a `<Table>`
   or `<Card>` whose look differs, do not use it as a shortcut. Restyle it to
   match exactly, or build to spec.
6. **Do not add anything.** No extra columns, no helpful tooltips, no
   breadcrumbs, no unspecified icons or animations, no "while I was in there"
   polish.
7. **Do not remove anything.** If something looks redundant, it is
   load-bearing somewhere else in the flow.

**When you cannot follow the spec exactly: stop and ask.** Real reasons — a
platform constraint makes an interaction impossible; two parts of a document
genuinely contradict each other; the data a screen needs does not exist in the
API. Not reasons: the spec differs from your usual practice, the component
library has something close, you think another layout would be better, it
would be faster the other way.

**What you may change freely:** the implementation underneath. Framework,
component structure, state library, CSS methodology, file organisation,
naming. The prototype is inline-styled for streaming previews — do not carry
inline styles into production.

**Definition of done:** put your build and the prototype frame side by side at
the same width. They should be difficult to tell apart.

---

## What the two modules share

Build these once and both roles consume them.

- **The shell** — 230px sidebar collapsing to a 62–64px icon rail, the topbar
  with `‹` back grouped with the wine Quick actions button, the breadcrumb, the
  theme and close controls, the phone drawer below 880px.
- **The page template** — title + `?` badge, four-cell stat strip, chip row +
  primary, content, 300px right rail carrying a wine rule card and a context
  card.
- **The form template** — tab pills, title + badge, the gate card, the fields
  card, the tone banner, the action row with a primary that dies on a `bad`
  gate.
- **The six non-negotiables** from `CLAUDE.md` — back button, quick menu,
  collapsible taskbar, weekly planner, My tasks, floating chat.
- **The tone system** — `ok` / `warn` / `bad` / `wine` / `plain` as
  `[background, foreground]` pairs, with glyphs `✓` / `!` / `✕` / `?`.
- **The design tokens** — identical in both specs; one sheet.

The task store is **not** shared. Each role has its own (`uphTasks`,
`prdTasks`). Neither is a global inbox.

## What is genuinely different

| | Upholstery (20a) | Production (22a–22d) |
|---|---|---|
| Board shape | **five stages in one order**, nothing overtakes | **four parallel lanes on one clock** |
| Dependency | every stage inherits its start from the one before | paint and install pull from joinery |
| The hard thing | fabric is a **batch** — one roll, one dye lot, one lay | paper is **physical** — a sheet on a saw |
| Custom pages | Fabric & COM register, Crews & labour | Material & reservations, Teams & labour |
| Flows | 10 | 12 |
| Editor | fabric-plan builder (nap, repeat, single-lay metres) | BOM editor (EST join, man-days, upload review) |
| Printable | A4 cutting & sewing ticket | — |
| Build state | from scratch | **already in code** — corrections + 2 additions |

## The rule both modules exist to enforce

**Neither role ever sees a selling price, a margin or a labour rate.** Both see
material cost and supplier quotes, because both take those quotes themselves.
Both return quantities and hours and stop there — the estimator turns them into
money.

And **sales never sees any of it.** No price, no cost, no supplier name
reaches a sales screen. That is the fraud-prevention rule after a real
incident, and it is filtered **server-side** in both modules. Do not rely on
the client to hide a field.

## The gate mechanism, in both modules

Every create flow opens with one question. The primary button is **dead until
it is answered**, and stays dead on a `bad` answer. A `warn` answer lets it
through and says so on the record.

**Entering any flow from anywhere must reset the gate to null.** A gate that
arrives pre-answered in the job's favour defeats the entire mechanism. Both
prototypes do this on every navigation.

The blocked copy is **not a validation message — it is the business rule.**
"Nobody cuts." "Cannot release." "Take the sheet off the saw first." "The lane
will not take it." Keep the words.

## The badge rule, in both modules

A heading's **description of what a card is** may fold into a `?` hover badge.
An explanation that is **load-bearing at the decision** stays as text.

Stays as text everywhere: rule card bodies, gate decision reasons, field
hints, material consequence lines. Concretely — Production's "Waiting for a
lane" keeps its red sentence, and Upholstery's COM refusal keeps its.

**`title` does not open on a tap.** Do not ship hover-only badges to either
phone build; use the tappable `? What this page is for` chip that expands
inline.
