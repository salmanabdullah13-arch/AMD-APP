# Handoff: Production module (directions 22a · 22b · 22c · 22d)

## ⛔ READ THIS FIRST — the design is fixed

**Do not redesign, restyle, re-lay-out, simplify or "improve" anything in this
package.** Every number here — every px, every hex, every column width, every
font size, every gap — is a decision that was made deliberately, reviewed and
signed off. Your job is to **reproduce it**, not to interpret it.

Unlike the other handoffs in AMD-APP, **this module already exists in code.**
It lives in `production-ui.js` / `production.css` and it renders today. So the
contract here is narrower and stricter:

1. **22a is a record, not a request.** It is the live screen redrawn so it can
   be marked up. Nothing in 22a is a change. Do not "apply" 22a.
2. **22b is the change to make to the dashboard.** Five heading sub-lines
   become `?` hover badges. That is the whole change. Nothing else on the
   dashboard moves.
3. **22c is the specification for the twelve pages and twelve create flows.**
   Every title, sub-line, stat label, chip, column head, button caption, rule
   card and gate question in it is lifted verbatim from `production-ui.js`.
   Where the prototype and the code disagree, **the prototype is now the
   spec** — the differences are the corrections.
4. **22d is the BOM editor** that sits under the `bomb` flow's three wrapper
   fields. It does not exist in code yet. Build it to spec.

Rows and quantities in 22c and 22d are **representative** — they were written
by reading the code, not by reading your live store. Copy the *shape*, the
column set, the tone rules and the arithmetic; take the data from the API.

### What you may change freely

The implementation underneath. Framework, component structure, state library,
CSS methodology, file organisation, naming. The prototype is inline-styled for
streaming previews — **do not carry inline styles into production.** Map the
tokens onto `production.css`.

### Definition of done

Put your build and the prototype frame side by side at the same width. They
should be difficult to tell apart.

---

## Overview

The Joinery Production Manager's module — Salman Abdullah, who runs Crew A and
Crew B, saw 1–2, the veneer press, the spray booth and two install vans. One
app, three view modes off a single shell, structurally identical to Purchase
(17a), Store (18a) and Upholstery (20a).

| Direction | What it is | Status |
|---|---|---|
| **22a** | Production dashboard, desktop 1440, as the app renders it on 26 Aug 2026 | record only |
| **22b** | The same dashboard with five sub-lines folded into `?` badges | **build this** |
| **22c** | All twelve working pages and all twelve create flows, one clickable rail | **build this** |
| **22d** | The BOM spreadsheet editor under the `bomb` flow | **build this** |

- **Dashboard** (`prdView: 'dash'`) — Asked of you today, the week board,
  Waiting for a lane, paperwork, Teams today, KPIs, planner, tasks.
- **Working page** (`pcView: 'page'`) — twelve list pages, one template, driven
  by `pcPage`. Two break the template: **Material & reservations** and
  **Teams & labour**.
- **Create flow** (`pcView: 'form'`) — twelve flows, one template, driven by
  `pcForm`. Every flow opens with a **gate question** and the primary button is
  dead until it is answered.

### Why the module is shaped this way

Joinery is **four parallel lanes on one clock**, not a serial line. Joinery
Crew A, Joinery Crew B, Sofa & upholstery, Paint & polish, Site installation.
Paint and installation do not get dates of their own — they **pull** them from
joinery, so moving one joinery slot moves everything after it. That is why the
board has a dashed `pull` cell state and why it is the loudest thing on the
dashboard.

The second shaping force is **paper**. A BOM revision does not stop the man
cutting to the sheet already in his hand. So the module models the sheet, not
just the revision: a cutting list stays alive and red until somebody physically
confirms it off the saw.

---

## The five design commitments

**They are the point of the module — do not dilute them.**

1. **A lane will not take a job with no material or a pending revision.**
   Enforced in the data layer, not in the form. The board shows the refusal
   with the reason on it — three job cards sit in "Waiting for a lane" saying
   *"No BOM — the estimator hasn't costed the lines."*
2. **Paint and install pull their dates from joinery.** Cells that inherit a
   start render **dashed wine** (`pull`), never solid, and move when the
   upstream cell moves. A site fit stays provisional until paint is finished.
3. **Take the sheet off the saw first.** A revision kills the cutting list cut
   from the revision before it, and the list does **not** clear itself. The
   `bom` gate asks where the old sheet physically is, and "Still on a saw" is a
   `bad` answer that blocks the revision.
4. **Overtime buys hours, not material.** Every shift is booked against the
   target it recovers *and* the cause of the slip, from a closed enum. A shift
   on a job whose boards are not there is a paid idle day and is refused.
5. **He returns hours and quantities, never a price.** Man-hours, quantities,
   machine time, man-days. The estimator applies rates. **He never sees a
   labour rate** — not on the BOM editor, not in a total, not in a tooltip.

---

## The six non-negotiables (CLAUDE.md)

All six are present in 22a and must stay present in 22b/22c.

1. **Back button** — `‹` 32×32 in the topbar, immediately left of Quick
   actions, in the same flex wrapper. Hidden on the dashboard root.
2. **Quick menu at the top** — one wine "＋ Quick actions" button, 32px tall,
   popover on desktop, bottom sheet on phone. Never a row of separate buttons.
3. **Collapsible side taskbar** — 230px rail collapsing to a **62px icon rail**
   via `«` / `»`. Sixteen items with badge counts, from
   `EXEC_NAV_CONFIGS.production` verbatim. Below 880px it becomes a slide-in
   drawer behind `☰`.
4. **Weekly planner** — collapsible card, count when collapsed. Week/Month
   switch and `‹ Today ›` stepping; selection follows the period.
5. **My tasks** — collapsible, Apple Reminders model: smart tiles
   (Today / Urgent / All / Completed), user lists, tasks linkable to a job
   card. **Production has its own task store** — never shared.
6. **Floating chat box** — wine bubble bottom-right with unread badge; opening
   it replaces the bubble so the two never overlap.

---

## Hard rules

- **Production sees material cost and supplier quotes; never the selling
  price, the margin or a labour rate.** Cost and lead time are both visible on
  Supplier quotes because the choice is between them. Selling price, margin,
  quote value and per-man pay are not — not on a row, not in a summary, not on
  a printed sheet. **Filter them server-side.**
- **Sales never sees any of it.** Same fraud-prevention rule as the rest of
  AMD-APP: no price, no cost, no supplier name reaches a sales screen.
- **Work is allotted to a crew, never to a person.** The one exception is
  Teams & labour, which assigns *membership*. Wages, leave and attendance
  belong to the labour dashboard; this module hands over **hours** and stops.
- Currency `BD 1,350.000` (3 decimals). Dates `DD MMM YYYY`.
- Working week is **Sunday to Thursday**. Friday and Saturday are `wknd`
  cells, dead grey, **unless overtime is booked**, which turns them green.
- No external libraries, no CDN, no build step. Charts are plain SVG/CSS.
- One dashboard per role. There is no global menu to fall back on.

### Chart rule

A bar's fill must never share a flex line with text, and must never contain a
label. Label above the bar, or in a fixed-width column beside it, with the
fill inside a full-width track.

---

## Shell geometry

Desktop frame **1440 × 1037** (22c) / **1440 × 1008** (22a, 22b).

| Element | Spec |
|---|---|
| Sidebar | 230px, `--card`, 1px `--line` right border |
| Icon rail (collapsed) | 62px, buttons 38 × 32, radius 9 |
| Rail brand mark | 30 × 30, radius 8, `--sunk`, 1px `--line`, wine glyph `▟` |
| Rail section label | 9.5px/700, `.12em`, uppercase, `padding: 7px 10px 5px` |
| Rail user footer | 28px wine monogram, name 11.5px/650, role 9.5px `--tx3` |
| Topbar | `padding: 12px 20px`, `--card`, 1px `--line` bottom |
| Topbar controls | 32px tall, radius 9; back button 32 × 32; theme/close 32px round |
| Breadcrumb | `Production › <page>`, 11px `--tx3`, current 11px/600 `--tx2` |
| Content padding | `16px 20px 40px`, two columns `gap: 16px` |
| Right rail | **300px** on page and form views |
| Card radius | 16 (dashboard), 12–13 (page cards, gate card, nested tables) |
| Stat cell | `padding: 11px 13px`, radius 12, 1px `--line2`, value 18px/700 |
| Chip | 26px tall, `padding: 0 11px`, radius 16, 11px |
| Table column head | 9.5px/700, `.05em`, uppercase, `--sunk`, `padding: 7px 8px` |
| Table cell | `padding: 9px 8px`, `vertical-align: top`, 1px `--line2` bottom |
| Pill | `padding: 3px 9px`, radius 20, 9.5px/700, nowrap |

---

## Design tokens

Light theme is primary; dark must work. `data-theme` on the root element.

```
--wine:#600131  --wine2:#7c1a4a  --wine3:#9c3d6c
--wine-tint:#f7eef3  --wine-line:#ecd9e3
--page:#f5f6f8  --card:#ffffff  --sunk:#fafbfc
--line:#e6e8ee  --line2:#eff1f5
--tx:#101828  --tx2:#475467  --tx3:#98a2b3
--ok:#087443  --ok-bg:#e8f6ef
--warn:#b54708  --warn-bg:#fef3e6
--bad:#b42318  --bad-bg:#fdecea
--sh:0 1px 2px rgba(16,24,40,.04)
--sh2:0 6px 24px rgba(16,24,40,.10)
```

**Tone pairs** `[background, foreground]`: `ok` · `warn` · `bad` · `wine` ·
`plain` (`#eef0f3` / `--tx2`, ink `--tx`). Tone glyphs: `ok → ✓`,
`warn → !`, `bad → ✕`, unanswered → `?`.

Type: 19px/650 page title · 17px/650 form card title · 12.5px/700 section
titles · 11.5px/650 row titles · 11.5px body · 11px meta · 10.5px sub-meta ·
9.5px/700/.05em uppercase column heads. Tabular numerals on every quantity.

---

# 22b — fold five sub-lines into `?` hover badges

The dashboard loses five sub-lines; each heading gains a `?` badge revealing
the same sentence on hover. **Buys back ~120px of vertical space** — a card
and a half — so the week board's first row is visible without scrolling at
1440 × 900.

Badge: 17 × 17, `border-radius: 999px`, 1px ring, `--card` fill, 10.5px/700
glyph, `cursor: help`, `gap: 7px` from the heading on one flex row. Ring and
ink by tone: **wine** on wine-tinted card headers, **neutral**
(`--tx3` / `--tx2`) on plain ones, **bad** where the sub-line states a refusal.

The five headings that get one:

| Heading | Tone | Sub-line that becomes the tooltip |
|---|---|---|
| Production (page title) | neutral | the `Wednesday, 26 August 2026 · 1 thing asked of you · …` line |
| Asked of you today | wine | Other people's deadlines. These come before the board, because somebody is waiting on the other end. |
| The week board | neutral | Four lanes, one clock. Paint and install pull their dates from joinery — move a joinery slot and the ones after it move with it. Green Friday cells are overtime, booked against the target they recover. |
| Waiting for a lane | bad | *(heading badge only — see below)* |
| Teams today | neutral | Crews and where they physically are. Who stands in each crew is the labour dashboard's business. |

Paperwork and This week have no sub-line, so no badge.

`title=` is plain text — **strip the `<b>` tags** before passing the string.

The exact code — the `qBadge()` helper, the four call sites in
`askedHTML()` / `boardHTML()` / `teamsHTML()` and the page title, and the
optional CSS hoist — is in `design_handoff_22b_badges/README.md`. Follow it
literally.

## The badge rule — where it stops

**Only descriptions of what a card *is* become badges. An explanation that is
load-bearing *at the decision* stays as text.**

Four things stay visible across all twenty-four screens:

1. **Rule card bodies.** The wine rule card on every page *is* the rule. It is
   not an explanation of the page.
2. **Gate decision reasons.** The `bad` and `warn` notes under a gate option
   are what the user is deciding between.
3. **Field hints.** *"Closed list, on purpose — free text cannot be counted."*
4. **Material consequence lines.** *"Reserve from Riffa or take supplier
   quotes before Sunday."*

Concretely: the **"Waiting for a lane"** strip keeps its red sentence as text —
*"A lane will not take a job with no material or a pending revision"* — because
that sentence explains why three job cards are sitting there refused. Hiding
the reason behind a hover at the exact moment somebody asks "why is this stuck"
costs more than the line saves.

## Phone

`title` does not open on a tap. **Do not ship hover-only badges to the phone
view.** Use the tappable-chip pattern instead: a `? What this page is for`
chip that expands the text inline on tap.

## Check when done

1. Hover each of the five badges — the text appears, and it is the same
   sentence that used to be printed.
2. The week board's first row is visible without scrolling at 1440 × 900.
3. "Waiting for a lane" still shows its red sentence as text.
4. Nothing else on the dashboard moved: the KPI rail, planner and paperwork
   card are untouched.

---

# 22c — the twelve pages and the twelve flows

## Page template

Title 19px/650 + `?` badge on one flex row. A **four-cell stat grid**
(`repeat(4, 1fr)`, `gap: 9px`, value 18px/700 in tone, label 9.5px uppercase
`--tx3`). A **chip row** with the count inside each chip, then the wine
**primary** button pushed right (32px, radius 9 — omitted entirely on pages
with no primary). Then the content: a table, or one of two custom layouts.

Right rail **300px**: a **wine rule card** (the page's business rule) and a
**context card** (`ctxT` heading, label/value rows, optional footnote).

`chips` carry counts; `cols` with an empty header right-align; `cell(t, sub)`
renders a title 11.5px/650 with a 10px `--tx3` sub-line under it; `cell(…,
{dim: true})` renders it 11.5px italic `--tx3` — that is the "—  not set"
treatment on the Week board's Target out column.

### The twelve pages, in rail order

| Key | Title | Primary → flow | Custom |
|---|---|---|---|
| `board` | Week board | Allot a lane → `allot` | — |
| `price` | Pricing input | Return input → `price` | — |
| `bomb` | BOM input for budgeting | Return input → `bomb` | — |
| `bom` | BOM changes | Start a revision → `bom` | — |
| `quote` | Supplier quotes | Ask for prices → `quote` | — |
| `cut` | Cutting lists | Create a cutting list → `cut` | — |
| `press` | Veneer pressing | Start a batch → `press` | — |
| `ot` | Overtime & recovery | Book overtime → `ot` | — |
| `rem` | Reminders | **none** | — |
| `doc` | Documents | **none** | — |
| `mat` | Material & reservations | Reserve for a job → `res` | `mat` |
| `team` | Teams & labour | Assign labour → `lab` | `team` |

`rem` and `doc` have **no primary button at all.** A reminder nobody is waiting
on is a to-do, and those live in My tasks; documents are derived from the
paperwork that exists, so there is nothing to create. Do not add a button to
either.

**Paint & polish and Site installation** — the two pages that were left off —
share the `board` renderer. One instruction covers both: same template, same
stat set shape, lane filtered to the department, `pull` state on every cell
whose start is inherited.

### Page copy — verbatim

Sub-lines (these are the `?` tooltips), stat sets and rule cards, per page:

**`board` — Week board.** Sub: *"One row per lane, and one for every job a lane
has refused. The target-out column is the date the job is promised, not the
date it is booked."* Stats: Lanes 5 · Days booked 11.5 · Lanes with no work 0
(ok) · Refused a lane 3 (bad). Chips: All 8 · Lanes 5 · Refused 3. Columns:
Lane / job · Target out 130px · (action) 120px. Rule: *"A lane will not take a
job with no material or a pending revision. Book the material first, or the
lane books an idle day."* Context **"Refused, and why"**: three job cards,
`no BOM`, all bad. Eight rows: five lanes (Crew A `Over`, Crew B `On track`,
Sofa & upholstery `Light`, Paint & polish `Light`, Site installation `Light`)
then three `Refused` job cards, each sub-lined *"No BOM — the estimator hasn't
costed the lines."* **Target out is `— not set` on every row** — that is real,
not a placeholder; it is one of the eight drift notes on 22a.

**`price` — Pricing input.** Sub: *"Requests arrive from the estimator and from
nowhere else. There is no new-request button here — the button returns
input."* Stats: Requests 4 · Open 1 (warn) · Due today or past 1 (bad) ·
Answered 3. Rule: *"Requests come from the estimator only — not sales, not the
client, not production itself. You return hours and quantities; the estimator
turns them into money."* Context **"What you may return"**: Man-hours yes ·
Quantities yes · Machine time yes · **A rate or a price never (bad)**, footnote
*"You do not send a price. The estimator prices it."*

**`bomb` — BOM input for budgeting.** Sub: *"Raised by the operations manager
only, on jobs that are already approved. Build the BOM and the project budget
is set from it."* Stats: Requests 3 · Open 1 (warn) · Due today or past 1
(bad) · Answered 2. Rule: *"What you submit becomes the department budget, and
operations approving it is what opens production. A guessed BOM is approved as
if it were real."* Context **"What goes on a job BOM"**: Materials from the
Item Master yes · Quantities yes · Labour as days × men yes · **A labour rate —
you never see one (bad)** · **A selling price never (bad)**, footnote
*"Subcontract and hiring are money somebody else commits — they are not on this
form."*

**`bom` — BOM changes.** Sub: *"Every revision, and the cutting lists it
killed. A dead list clears when the sheet is confirmed off the saw — not when
the new revision is issued."* Stats: Revisions 3 · Lists killed 2 · Still on a
saw 1 (bad) · Draft 1. Rule: *"A BOM change kills the cutting list cut from the
revision before it. The list does not clear itself — somebody has to take the
sheet off the saw and say so."*

**`quote` — Supplier quotes.** Sub: *"Comparisons from Purchase. Cost and lead
time are both visible here because the choice is between them — the cheapest
quote is not the cheapest option when the floor is waiting."* Stats: Enquiries
4 · Quotes back 2 (warn) · Awarded 1 · Quotes in total 7. Rule: *"Asking for
prices commits nothing. It is how a lead time gets chosen before an order is
placed, not a way to place one quietly."*

**`cut` — Cutting lists.** Sub: *"Live sheets, and what is on which saw. A
sheet cut from a superseded revision stays here until somebody confirms it off
the saw."* Stats: Sheets 4 · On a saw 2 · Dead, still cutting 1 (bad) · Parts
listed 86. Rule: *"Take the sheet off the saw first. A revision does not stop
the man cutting to the paper already in his hand."* CL-0044 is the `bad` row —
`Dead — take it off`, saw 2.

**`press` — Veneer pressing.** Sub: *"Batches by veneer. Two jobs pressed in
one run use one set-up instead of two, and the sheets saved are the reason to
wait for the second."* Stats: Batches 2 · Still collecting 1 (warn) · Jobs
batched 3 · Sheets saved 0 (ok). Rule: *"A batch waits for the second job or it
saves nothing. Pressing one job alone is the same cost as pressing it late."*

**`ot` — Overtime & recovery.** Sub: *"One row per shift: what it recovers, and
what caused the slip. The same cause three weeks running is a planning problem,
not a labour cost."* Stats: Shifts booked 13 · Man-hours 336 · Refused 2
(bad) · Biggest cause `BOM revision late`. Rule: *"Overtime buys hours, not
material. A shift on a job whose boards are not there is a paid idle day, and
it is refused."* Context **"Last 4 weeks by cause"**: BOM revision late 96 h
(bad) · Client change 32 h (warn) · Nothing recoverable 2 refused (bad).

**`rem` — Reminders.** Sub: *"Every row points at a crew waiting. A reminder
nobody is waiting on is a to-do, and those live in My tasks."* Stats:
Reminders 14 · Somebody is stopped 4 (bad) · Worth watching 10 (warn) · Crews
affected 3. Rule: *"A reminder here means a crew cannot work. If nobody is
stopped, it belongs in My tasks instead."*

**`doc` — Documents.** Sub: *"Filed against the job card. This list is derived
from the paperwork that actually exists — there is no separate register to keep
in step, because one kept by hand goes stale and then it lies."* Stats:
Documents 9 · Job cards 5 · Cutting lists 4 · Superseded 1 (bad). Rule:
*"Production paperwork belongs to the job card, not to a folder. Everything
here is derived from a real record, so it cannot drift out of step with the
shop."*

**`mat` — Material & reservations** (custom). Sub: *"One row per material,
against the job that needs it. Free of need is read live off the shelf, not
from the BOM."* Stats: Materials 6 · Short 2 (bad) · Held for a job 3 (ok) ·
On the shelf, not held 1 (warn). Rule: *"Stock on the shelf is not stock you
have. Until it is held against this job card, another job can take it — and the
lane you booked becomes an idle day."* Context **"Short, and who waits"**:
Beech veneer 0.5mm `0 of 14` (bad) · MDF 18mm 2440×1220 `4 of 12` (bad).

Row layout follows 20a's `fab` page: item name 12.5px/700 + job chip, a detail
line, a **consequence line** 10.5px/650 in tone, a right-aligned
`FREE OF NEED` column at 14px/700 tabular, and a **192px action stack** —
**Reserve** (wine when something is free; `--ok-bg`/`--ok` non-interactive and
labelled `Reserved` when already held; `--line2`/`--tx3` `not-allowed` and
labelled `Nothing to reserve` when there is nothing), **Request purchase**
(wine outline — *commits*), **Ask for prices** (`--line` outline — *commits
nothing*).

**`team` — Teams & labour** (custom). Sub: *"Who is in each crew, and who is in
none. Work on the week board is allotted to a crew, never to a person — so a
man with no crew cannot be given any."* Stats: Men 28 · Crews 5 · Not in a
crew 3 (warn) · Idle today 2 (bad). **No chips.** Rule: *"A man with no crew
cannot be given work, because everything on the week board is allotted to a
crew and never to a person. Assign him, or he is a paid day producing
nothing."* Context **"Idle today"**: Anil Das · Joinery Crew B (bad) ·
Mohammed Iqbal · Sofa & upholstery (bad).

Layout follows 20a's `team` page: five expandable crew cards, one open at a
time, 34px wine-tint monogram, collapsed header with load pill and chevron,
wine border on the open card; expanded shows a `--sunk` strip
(`WHO IS IN THIS CREW` / `ON TODAY` 150px / 62px spacer), one row per man with
a 28px state-tinted monogram, a solid wine `LEADER` chip where applicable, and
a 62px **Move** button; dashed wine `＋ Assign labour to <crew>` footer. Below
the crews, a **"Not in a crew"** card with the three unassigned men.

---

## Create flows

Tab order — twelve pills, active one solid wine, 25px tall, radius 15,
10.5px:

`Pricing · Job BOM · BOM change · Reserve · Purchase · Prices · Cutting list ·
Press · Allot · Overtime · Labour · Install`

Skeleton, top to bottom:

1. **Tab row.**
2. Title 17px/650 + `?` badge carrying the flow's sub-line.
3. **Gate card** — radius 13, `padding: 14px 15px`. Neutral (`--card`, 1px
   `--line`) while unanswered, then **re-tinted to the tone of the chosen
   answer**. A 22px round mark badge (`?` → `✓` / `!` / `✕`), the question
   12.5px/700, the reasoning 11.5px, then 2–3 option buttons (radius 10,
   `padding: 8px 11px`, 11.5px) each with a note: `blocked` on a `bad` option,
   `allowed, and it will show` on a `warn` one, nothing on `ok`. The selected
   option takes a 1px border and ink in its own tone at weight 650.
4. **Fields card** — label 10.5px/700 uppercase `--tx3` above a `--sunk` box.
   Full-width fields where marked; hints 10.5px `--tx3` below.
5. Optional **editor** — the `bomb` flow's BOM spreadsheet (see 22d), reached
   from a dashed wine jump card.
6. **Banner** — full-width strip in the gate's tone:
   - unanswered → `plain`, *"Answer the question above. Nothing is saved until
     you do."*
   - `bad` → the chosen option's own blocked reason
   - `warn` → the option's note + *"`<primary>` will record it that way."*
   - `ok` → *"`<primary>`. It will be recorded against the job card."*
7. **Actions** — primary wine when the gate is `ok`/`warn`; **dead** when the
   gate is unanswered or `bad`. Plus Cancel.

Right rail 300px: the flow's **wine rule card**.

### The gate table — this is the enforcement layer

`ok` and `warn` make the primary **live**; `bad` leaves it **dead**.

| Flow | Gate question | Options → tone |
|---|---|---|
| `price` | What are you sending back? | Hours and quantities `ok` · A rough guess `warn` *(it will be shown as a guess)* · **A price `bad`** *(you do not send a price)* |
| `bomb` | Is this job's BOM complete enough to budget from? | Complete — every item is on it `ok` · Complete for now, items still to price `warn` *(the gap travels to the approver)* · **Still guessing at the main items `bad`** *(a guessed budget is approved as if it were real)* |
| `bom` | Where is the old cutting list right now? | **Still on a saw `bad`** *(take the sheet off the saw first)* · Back in the office `ok` · Never released `ok` |
| `res` | Is the BOM revision current? | The current revision `ok` · **A revision is pending `bad`** *(you will hold the wrong boards)* · Reserve anyway `warn` |
| `purch` | Are you committing, or asking? | Commit — buy it `ok` · Ask for prices first `ok` · **Not sure yet `bad`** *(then it is not a purchase request)* |
| `quote` | Why is this not coming from stock? | Not held anywhere `ok` · Held stock is reserved elsewhere `ok` · Faster to buy than to wait `warn` |
| `cut` | Which BOM revision is this cut from? | The current revision `ok` · **A superseded revision `bad`** *(that revision is dead)* · **There is no BOM `bad`** |
| `press` | Batch it, or press alone? | Batch it with the open run `ok` · Press alone `warn` *(it saves nothing)* · Wait for a batch `ok` |
| `allot` | Is the job clear to take a slot? | Material reserved · BOM current `ok` · **Material short `bad`** *(the lane will not take it)* · Overload the crew `warn` |
| `ot` | What is this overtime actually recovering? | A slipped target `ok` · **A material delay `bad`** *(nobody can cut boards that are not there)* · **No stated cause `bad`** |
| `lab` | Which crew is he going into? | His trade matches the crew `ok` · The crew is already over `warn` · **Not his trade `bad`** |
| `inst` | Where has paint got to? | Paint is complete `ok` · Paint is booked, not finished `warn` *(the fit stays provisional)* · **Paint is not scheduled `bad`** *(there is no date to pull from yet)* |

**The blocked copy is not a validation message — it is the business rule.**
"Take the sheet off the saw first." "The lane will not take it." "Nobody can
cut boards that are not there." Keep the words.

### Field sets — verbatim, in order

- **`price`** The request (select, *"Requests come from the estimator only."*,
  full) · Man-hours (number, *"Total, across the crew."*) · Quantity (number,
  *"Per unit made."*) · Machine time (hours) (number, *"Saw, press, spray
  booth."*) · Note (text, full)
- **`bomb`** The request (select, placeholder *"No request — resubmitting after
  a rejection"*, *"Requests come from operations only."*, full) · Job card
  (select, *"The BOM below is this job's."*, full) · Note for the approver
  (text, full) — **then the 22d editor**
- **`bom`** Job card (select, full) · What changed (text, e.g. *"Carcass depth
  600 → 550"*, full) · Why (text, *"It travels with the revision."*, full)
- **`res`** Job card (select, *"Everything on its BOM that is free will be
  held."*, full)
- **`purch`** Item (select, full) · Quantity (number) · Needed by (date) · Job
  card (select, *"The order is raised against it."*, full) · Note for Purchase
  (text, full)
- **`quote`** Item (select, full) · Quantity (number) · Needed by (date) ·
  Note for Purchase (text, full)
- **`cut`** Job card (select, full) · Saw (select, placeholder *"Not yet on a
  saw"*) · Revision (text, *"Pulled from the job's current revision."*)
- **`press`** Veneer (text, *"A batch is one veneer."*, full) · Add to an open
  batch (select) · Job card (select) · Sheets (number)
- **`allot`** Crew (select) · Job card (select) · Day (date) · Portion
  (select, default *Full day*)
- **`ot`** Crew · Day · Hours · Men · Recovers (select, *"A shift is booked
  against the target it recovers."*, full) · Cause of the slip (select,
  ***"Closed list, on purpose — free text cannot be counted."***, full)
- **`lab`** Who (select, full) · Into which crew (select, *"Leaving it blank
  takes him out of his crew."*, full)
- **`inst`** Site fit (select, *"Only fits that are still provisional."*, full)

### Entering a flow resets the gate

Every navigation into a create flow **must set the gate to null.** A gate that
arrives pre-answered in the job's favour defeats the entire mechanism.

---

# 22d — the BOM editor under the `bomb` flow

**This is the half of "BOM input for budgeting" that does not exist yet.** It
sits under the three wrapper fields: one section per department the manager
owns — **Joinery** and **Paint & polish** — each with a material table and a
labour table.

The two sections **go in together**: one submission, two budgets, because
joinery and paint are one job for one manager but two production gates. Say so
in a wine-tinted strip above the action row.

## Section card

Radius 13, 1px `--line2`, `--card`, `--sh`. Header `padding: 11px 13px`:
department name 12.5px/700, a 10px `--tx3` live count line
(`6 material lines · 24 man-days`), and the **pull button** on the right.

### The pull preview — pull *shows* before it *does*

The header button reads **`Pull N lines from the estimate ▾`** where N is
material lines + labour tasks. It does **not** apply. It expands an inline
`--warn-bg` panel above the tables:

- Head: `What comes in — N material, M labour`, plus a `Close` button.
- One row per incoming line inside a scrollable box (`max-height: 220px`):
  a 12px mark column — **`＋` in `--ok`** for a line that is new, **`·` in
  `--tx3` at `opacity: .5`** for one already on the form — then the name, a
  52px uppercase `Material` / `Labour` kind column, and a 104px right-aligned
  quantity (`14 Nos` / `3 men × 4 days`).
- Confirm button: **`Bring in N lines`** in wine — or a dead `#e6e8ec` /
  `#9aa1ae` `not-allowed` **`Nothing to bring in`** when every line is already
  present.
- Note beside it, by case: all new → *"None of these are on the form yet.
  Quantities arrive as the estimator allowed them; you correct them here."* ·
  none new → *"Every one of these is already on the form. Pulling again
  changes nothing — it will not double a line."* · mixed → *"N of M are new.
  The rest are already on the form and are left alone, not doubled."*

While the panel is closed, an italic `--warn` hint sits under the count line
saying what will come in — *"Shows 4 material lines and 2 labour tasks at the
estimator's quantities"* — so the button's effect is legible without a click.
The button also carries `title="Shows you the lines first. Nothing goes on the
form until you press Bring in."`

**Pull replaces, never appends** — and the same holds for the upload. Pulling
or uploading twice must not double the budget; a line already on the form is
left alone, not duplicated. Same rule the cutting list already follows.

## What the estimator allowed

On the Joinery section only, a `--sunk` strip above the tables:
`WHAT THE ESTIMATOR ALLOWED` 9.5px/700 uppercase, then an italic coverage
line, then one chip per quoted product — product name 10.5px/650, quantity
9.5px `--tx3`, and a tone chip reading **`costed`** (ok) or **`no line`**
(bad).

Coverage line, 20-item case: *"20 items · BD 3,690.000 material and 196
man-days allowed in total. 3 items carry no material line of their own — the
EST column is real wherever it shows a number, and blank where a rough figure
covers the item."*

## Materials table

Above it, an **Item Master search** — full-width 30px input,
placeholder *"Search the Item Master by name…"*. Hits drop into a bordered
list, each a two-line button (name 11px/650, meta 9.5px `--tx3`). **No hits
shows a refusal, not an empty state:**

> Nothing in the Item Master matches. It has to be a real code — a line nobody
> can reserve is not a budget line.

(`--bad-bg` / `--bad`, radius 9. Type "walnut" to see it.)

Column set, and the widths are shared tokens — **the header strip and the row
strip must read the same variable for every column**, or a 6px drift appears
between the EST header and the EST data:

| Col | Width | Content |
|---|---|---|
| `#` | 22px | 10px `--tx3` |
| Item | flex 1, min 0 | 11px/600, ellipsis |
| Qty | 74px | **− / value / ＋** steppers, centred, `gap: 4px` |
| Est | *(token `bdCe`)* | the estimator's own quantity |
| Unit | *(token)* | 10px `--tx3` |
| Cost | *(token)* | 10.5px `--tx2` |
| Amount | *(token)* | 10.5px/650 `--tx` |
| ✕ | *(token)* | 20 × 20 remove button |

**EST is a fact, or blank.** It is the estimator's own quantity for that item
code, matched on item id — never a guess, never derived. **Blank** where he
never itemised it. It **reddens** when the manager's quantity goes over, and
carries a `title` explaining the comparison. Do not fill a blank EST with an
average.

## Labour table

Header row: `Add a task` outlined button on the right. Columns `#` 22 · Task
flex-1 (a text input, placeholder from the department's typical task) · **Men**
74 · **Days** 74 (both steppers) · **Man-days** (computed) · ✕.

**Man-days, never a rate.** Labour is men × days. It is costed at the floor
average on submit — **the manager never sees the rate.** Same wall as the
pricing flow.

## Footer totals

`--sunk`, 1px `--line2` top, two equal cells:

- **Materials** — total 14px/700, a 9.5px note, and a **delta line** when the
  section differs from the estimate: over → `bad`, under → `ok`.
- **Labour** — man-days 14px/700, note, and the same delta treatment.

⚠ **Known issue, stated in the 22d review:** the two deltas are the most
valuable numbers on the screen — over or under the estimate, per department —
and they sit at the bottom of a long scroll, below the labour table. **On a
20-item job nobody reaches them before pressing Submit.** Move them beside the
section header, where the decision is. Do this in the build.

## The upload-review state — the review owns the action row

Two entry points sit in a strip above the sections: **`⬇ Download as Excel`**
and **`⬆ Upload the filled sheet`**, with the note *"One sheet per department,
with what the estimator allowed alongside. Nothing is saved by the upload — you
review it here first."*

An upload waiting to be reviewed **replaces the editor entirely** — it does not
sit beside it. The review card (1px `--bad`) shows one row per uploaded line:
a mark, a 96px Dept column, a 72px Section column, the item or task with an
italic `--bad` **reason line** on the rows that failed, and an 88px
right-aligned quantity.

Its action row is:

- **`Use the N rows that work`** (wine)
- **`Discard the upload`** (outline)
- and an italic wine line: *"No Submit here — the review owns the action row
  until it is resolved."*

**Submit is gone, not disabled.** A budget cannot reach operations underneath
an upload nobody has read. This reads like a loading state and is not one — it
is the same maker-checker instinct as the gates, applied to a spreadsheet.
**Do not "fix" it by greying the button instead.**

## Density — the 20-item case

The prototype carries a size switch — **`This job · 5 lines`** and **`A 20-item
job`** — because the screen must survive a real job, not a demo one. At 20
items the material table scrolls inside the section card
(`max-height` with `overflow-y: auto`) rather than pushing the totals off the
page, and the coverage line reports how many items carry no material line of
their own. Build the scroll container; do not let the section grow unbounded.

---

## State

Per-role store. Never shared with another role.

| State | Type | Purpose |
|---|---|---|
| `prdView` | `'dash' \| 'page' \| 'form'` | dashboard shell view |
| `prdPage` / `pcPage` | page key | which working page (default `board`) |
| `prdForm` / `pcForm` | flow key | which create flow (default `price`) |
| `pcGate` | int \| null | selected gate option; **null = unanswered** |
| `pcChip` | int | active filter chip |
| `pcRail` | bool | sidebar collapsed to the icon rail |
| `prdQA` / `prdQAp` | bool | quick actions, desktop / phone |
| `prdChat` / `prdChatP` | bool | chat panel, desktop / phone |
| `prdWeekOpen` / `prdTasksOpen` | bool | card collapse |
| `prdScope` | `'W' \| 'M'` | planner week or month |
| `prdOff` | int | period offset — drives the week board and the planner |
| `prdSel` | int | selected day |
| `prdTasks` | array | production's own task store |
| `bdMat` / `bdLab` | object \| null | BOM editor rows; null = the estimate default |
| `bdPull` | dept key \| null | which section's pull preview is open |
| `bdQ` | string | Item Master search term |
| `bdMode` | `'edit' \| 'review'` | editor, or the upload under review |
| `bdBig` | bool | the 20-item density case |

---

## API notes

Every screen is job-card centred. A job card needs, for this module: the BOM
revision it is cut to and every revision before it, the cutting lists issued
against each revision **and which saw each sheet is physically on**, its
material reservations with free-of-need read live off the shelf, its lane
allotments by crew and day, its target-out date, and the derived start dates of
every downstream lane.

**A cutting list is a physical sheet, not a record.** A revision that
supersedes another does not clear the list cut from it. Model
`sheet_off_saw_confirmed_by` and `confirmed_at`; nothing else may clear a dead
list.

**EST must be a join, not a computation.** The estimator's quantity for an item
code comes from the quote's own itemised lines, matched on item id. Where the
quote carries a rough figure covering several items, return **null** for the
line and let the UI render blank. Never return an apportioned average — a
guessed EST is worse than no EST, because the manager will trust it.

**The Item Master is the only source of a material line.** Reject a BOM line
whose item code is not in the master server-side. A line nobody can reserve is
not a budget line.

**Uploads are staged, never applied.** An uploaded sheet lands in a review
staging table with per-row validation reasons. The BOM's own rows do not change
until the manager accepts. `submit_for_approval` must be **refused
server-side** while an unreviewed upload exists against the job.

Overtime posts `{crew, date, hours, men, recovers_target, cause}`. `cause` is a
closed enum and is **required**.

**Explicitly not in scope for this role's API responses:** selling price,
margin, quote value, client totals, labour rates, any per-man pay figure.
Material cost and supplier quotes **are** in scope. Filter the rest
server-side — do not rely on the client to hide them.

---

## Screen map

| Screen | Prototype source | Existing code |
|---|---|---|
| Dashboard as built | `#22a` | `production-ui.js` |
| Dashboard with badges | `#22b` | `production-ui.js` + `design_handoff_22b_badges/README.md` |
| Twelve pages, twelve flows | `#22c` | `production-ui.js`, `production.css` |
| BOM editor | `#22d`, `bomSectionHTML()` | **does not exist — build it** |
| Dashboard logic | `plVals()` (22a), `pbVals()` (22b) | — |
| Page/flow logic | `pcVals()` | — |
| BOM editor logic | `bdVals()` | — |

Shell, page template and form template are **shared with 17a (Purchase),
18a (Store), 19a (Production direction) and 20a (Upholstery)**. Build them
once. 22's own work is the four-lane pulling board, the two custom pages, the
twelve gates, and the BOM editor with its EST join and its upload review.
