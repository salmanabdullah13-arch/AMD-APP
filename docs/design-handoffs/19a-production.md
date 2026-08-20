# Handoff: Production manager module (direction 19a)

## ⛔ READ THIS FIRST — the design is fixed

**Do not redesign, restyle, re-lay-out, simplify or "improve" anything in this
package.** Every number in this document — every px, every hex, every column
width, every font size, every gap — is a decision that was made deliberately,
reviewed, and signed off. Your job is to **reproduce it**, not to interpret it.

This has gone wrong before. What comes back is recognisably "the same screen"
but with different spacing, a different card order, a component library's
default button instead of the specified one, a table turned into cards, a
sidebar turned into tabs. That is a failure, even when it looks fine in
isolation, because the result no longer matches the rest of AMD-APP.

### The contract

1. **Layout is frozen.** Column widths, card order, which column a card sits in,
   the number of columns, what is above what — all fixed. If a card is specified
   in the 340px right column, it goes in the 340px right column.
2. **Spacing, radii, type sizes and weights are frozen.** Use the exact values
   in the Design Tokens section. Do not round 12.5px to 12px, do not swap 650
   for 600, do not substitute a 4/8pt scale for the one specified here.
3. **Colour is frozen.** Wine `#600131` is the only brand accent. Do not
   introduce a second brand colour, do not tint with purple, do not replace the
   semantic red/amber/green.
4. **Copy is frozen.** Every label, subtitle, empty state and helper sentence is
   final. Do not rewrite for tone, length or "clarity". If a sentence seems odd,
   it is deliberate — it encodes a business rule.
5. **Component substitution needs permission.** If the target codebase has a
   `<Table>` or `<Card>` whose look differs from this spec, do **not** use it as
   a shortcut. Either restyle it to match exactly, or build the element to spec.
6. **Do not add anything.** No extra columns, no helpful tooltips, no
   breadcrumbs, no "while I was in there" polish, no icons that are not
   specified, no animations that are not specified.
7. **Do not remove anything.** If something looks redundant, it is load-bearing
   somewhere else in the flow.

### When you cannot follow the spec exactly

Stop and ask. Do not resolve it yourself. Real reasons to ask: a platform
constraint makes a specified interaction impossible; two parts of this document
genuinely contradict each other; the data the screen needs does not exist in the
API. Not reasons to ask, and not reasons to change: the spec differs from your
usual practice, the component library has something close, you think a different
layout would be better, it would be faster the other way.

**What you may change freely:** the implementation underneath. Framework,
component structure, state library, CSS methodology, file organisation, naming.
The prototype is inline-styled for streaming previews — do not carry inline
styles into production. Map the tokens onto the codebase's styling system.

**Definition of done:** put your build and the prototype frame side by side at
the same width. They should be difficult to tell apart.

---

## Overview

The joinery production manager's whole module: one app, three view modes off a
single shell, structurally identical to Purchase (17a) and Store (18a). He sits
between the estimator, the operations manager, the store, the purchaser and five
crews on the factory floor.

Three views share the shell:

- **Dashboard** (`prdView: 'dash'`) — the inbox, the week board, the paperwork
  queue, teams today, KPIs, planner, tasks.
- **Working page** (`prdView: 'page'`) — fifteen list pages, one template,
  driven by `prdPage`. Two pages break the template and are specified
  separately: **Teams & labour** and **Material & reservations**.
- **Create flow** (`prdView: 'form'`) — twelve flows, one template, driven by
  `prdForm`. Every flow opens with a **gate question** and the primary button is
  dead until it is answered.

Plus one printable: the **cutting list** at A4.

### What this role's day actually is

Two things, and the module is shaped as two artefacts because of it:

1. **People ask him for things, with deadlines.** The estimator wants pricing
   input before a quote closes. Operations wants consumption standards for a BOM
   budget. The store says a job is six boards short. The purchaser has three
   quotes back. → **"Asked of you today"**, the first card on the dashboard.
2. **Five crews wait to be told what to do.** Joinery Crew A, Joinery Crew B,
   sofa and upholstery, paint and polish, site installation. → **the week
   board**, the module's central artefact.

Everything else on the screen is the paperwork that turns one into the other.

---

## The five design commitments

**They are the point of the module — do not dilute them.**

1. **No lane slot without material and a live BOM.** The week board refuses a
   job whose material is short or whose BOM revision is pending. This is not a
   paperwork rule: a crew that starts and stops because half the boards are
   missing costs more than the day it waited. Refused jobs appear in the
   **"Waiting for a lane"** strip under the board with the reason on them.
2. **Paint and install pull their dates from joinery.** A spray slot is not a
   date of its own — it is joinery's finish date plus cure. Derived slots render
   **dashed wine**, never solid, and when the upstream slot moves they move with
   it. Same for install off paint. A date given to a client before the booth is
   booked is a date that will be broken.
3. **He returns hours and quantities, never a price.** Man-hours, board and
   veneer counts, process time, wastage percentages. The estimator turns that
   into money. He *does* see material cost and supplier lead times — he takes
   those quotes himself — but never the selling price or the margin.
4. **A BOM change kills the cutting list.** Any released sheet cut from an older
   revision is dead paper. The gate does not clear on issuing the new revision;
   it clears on **confirming the old sheet is off the saw**.
5. **Overtime buys hours, not material.** Every shift is booked against the
   target it recovers *and the cause of the slip*, so the pattern is visible: the
   same cause three weeks running is a planning problem, not a labour cost. An
   overtime request with no material and no work ready is refused — it is a paid
   idle day.

Corollary rule, stated on the pages that need it: **pricing input and budgeting
input are different things.** Same kind of numbers, different asker and
different question. The estimator wants the hours *this job* will take. The
operations manager wants the standard *a unit* should consume. They live on
separate pages and the gates enforce it, because mixing them is how a wastage
percentage ends up in a client's price.

---

## The six non-negotiables (CLAUDE.md)

All six are present and must stay present.

1. **Back button** — `‹` in the topbar, immediately left of Quick actions, in
   the same flex wrapper. Hidden on the dashboard root (`prdView === 'dash'`).
2. **Quick menu at the top** — one wine "Quick actions" button, popover on
   desktop (`prdQA`), bottom sheet on phone (`prdQAp`). Twelve items, each
   opening a create flow. Never a row of separate buttons.
3. **Collapsible side taskbar** — 230px sidebar (`prdRail === false`) collapsing
   to a **64px icon rail** (`prdRail === true`) via the `‹‹` / `››` button. On
   phone the `☰` button opens the same list as a **slide-in drawer**
   (`prdDrawer`) with a tap-away scrim. Rail icons carry a 6px tone dot instead
   of a count badge.
4. **Weekly planner** — collapsible card, count when collapsed. Week/Month
   switch, `‹ Today ›` stepping, selection drives the agenda below. **This is
   his own diary and is not the week board** — do not merge them.
5. **My tasks** — collapsible, Apple Reminders model: smart tiles (Today /
   Urgent / All / Completed), user lists (Pricing · BOM · Cutting · Teams),
   tasks linkable to a job card. **Production has its own task store** — never
   shared with Purchase, Store or any other role.
6. **Floating chat box** — wine bubble bottom-right, unread badge `4`. Opening it
   replaces the bubble with the panel so the two never overlap.

---

## Hard rules

- **Production sees cost, never selling price.** Material cost, supplier quotes
  and lead times are visible (he chooses on them). Selling price, margin, client
  totals and quote values are not — not on a row, not in a summary, not on a
  printed sheet. **Filter them server-side.** The checks panel on the pricing,
  quote and budgeting flows states this explicitly to the user; it is a real
  permission, not decoration.
- **Labour is crews here, individuals in the labour dashboard.** Work is allotted
  to a crew and a number of days, never to a named man. The one exception is the
  Teams & labour page, which assigns *membership* — who stands in which crew.
  Attendance, leave, overtime pay and rates belong to the labour dashboard;
  this module hands overtime **hours** to it and stops there.
- Currency `BD 1,350.000` (3 decimals) where cost appears. Dates `DD MMM YYYY`.
- Working week is **Sunday to Thursday**. Friday and Saturday are weekend cells
  and are dead grey **unless overtime is booked**, which turns them green.
- No external libraries, no CDN, no build step in the prototype. Charts are plain
  SVG/CSS.
- One dashboard per role. There is no global menu to fall back on.

---

## Shell geometry

Desktop frame **1440 × 980**. Phone frame **390 × 844**, unscaled, with a
112 × 30 notch at `top: 10px`.

| Element | Spec |
|---|---|
| Sidebar | 230px, `--card`, 1px `--line` right border |
| Icon rail (collapsed) | 64px, buttons 44 × 40, radius 10 |
| Topbar | 62px, `--card`, 1px `--line` bottom, `z-index: 6` |
| Topbar controls | 38px tall, radius 10; back button 38 × 38 |
| Quick actions popover | 296–312px wide, radius 14, `--sh2`, `animation: sheetup .16s` |
| Dashboard padding | `18px 22px 26px`, `gap: 18px` |
| Right column | **340px** on the dashboard, **300px** on page and form views |
| Card radius | 16 (dashboard/page cards), 14 (phone cards), 12 (nested tables) |
| Phone topbar | `padding: 54px 14px 11px` (clears the notch), controls 40px tall |
| Phone tab bar | 66px, four tabs: Asked · Board · Create · Floor |
| Phone chat bubble | 52 × 52 at `right:16px; bottom:82px` — clears the tab bar |

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

**Tone pairs** are used everywhere as `[background, foreground]`:
`ok` · `warn` · `bad` · `wait`(`--sunk`/`--tx3`) · `wine` · `plain`
(`--sunk`/`--tx2`). A pill is `padding: 3px 9px; radius: 999px; font-size:
10.5px; weight: 700`.

Type: 16px/650 topbar title · 15px/650 card titles · 13.5px/650 section titles ·
12.5px/650 row titles · 11.5px body · 11px meta · 10.5px sub-meta ·
10px/700/.05em uppercase column headers. Tabular numerals on every quantity.

---

## Dashboard, left column (top to bottom)

### 1. Asked of you today

Wine-tinted header card, radius 16, 1px `--wine-line`. Header: title 14.5px/650
wine, sub *"Other people's deadlines. These come before the board, because
somebody is waiting on the other end."*, count pill `5 open · 2 due today` in
solid wine.

Five rows, `padding: 12px 18px`. A row whose deadline tone is `bad` takes a
`--bad-bg` background. Row structure, left to right:

1. **Kind chip** — `PRICING` (wine) · `BOM` (bad) · `MATERIAL` (warn).
   9.5px/700, `.06em` tracking, radius 6.
2. Title 12.5px/650, then **who it is from** 11px `--tx2`, then the **need line**
   11px/650 in its tone.
3. **Due** — 104px right-aligned, 11.5px/700 in tone: `Today 16:00` (bad) ·
   `Tomorrow` (warn) · `Now` (bad) · `14 Aug` (warn).
4. **Action button** — 32px, wine fill, radius 9. Opens the matching create flow.

The five rows are the module's premise; keep all five and keep the wording:

| Kind | Title | From | Action → flow |
|---|---|---|---|
| PRICING | Pricing input for 9 wardrobes and 2 dressers — Amwaj Villa 18 | Estimator — Sara Khalifa · quote AMD-15402 | Return input → `price` |
| PRICING | Pricing input — 4-seater sofa and 2 armchairs | Estimator — Sara Khalifa · quote AMD-15398 | Return input → `price` |
| BOM | BOM revised — Seef reception counter is now REV C | Operations — Silva Fernandes · 11 Aug | Accept and reissue → `bom` |
| MATERIAL | 18mm oak-veneer MDF short by 6 boards — Amwaj wardrobes | Store — Jassim Abdulla | Reserve or quote → `res` |
| MATERIAL | Three supplier quotes back for brushed brass handles | Purchase — Rashid Al Doseri | Compare quotes → `quote` |

### 2. The week board

Radius 16, 1px `--line`, `--sh2`. Header: title 15px/650, sub *"Four lanes, one
clock. **Paint and install pull their dates from joinery** — move a joinery slot
and the ones after it move with it. Green Friday cells are **overtime**, booked
against the target they recover."* Right of the header: `‹` / `This week` / `›`
(30px controls) stepping `prdOff`.

**Column header strip** — `--sunk`, `padding: 8px 18px`: a 152px spacer labelled
`TEAM`, then seven flex-1 day labels `Sun 9 … Sat 15`, today in wine.

**Five lane rows**, `padding: 10px 18px`, `align-items: stretch`:

- **Label column, 152px fixed.** Crew name 12px/700 · capacity 10.5px `--tx3` ·
  load pill · **target line** 10px/700 in tone · **overtime badge** (inline-block,
  nowrap, radius 6, tone-tinted) when one exists.
- **Seven day cells**, `flex: 1`, `align-self: stretch`, `min-height: 46px`,
  radius 9, `padding: 5px 7px`. ⚠ **Do not give the cells a fixed `height`** — an
  explicit cross size defeats `stretch` and the grid stops reading as a grid when
  the label column grows.

Cell states — this is the whole vocabulary:

| State | Border | Background | Meaning |
|---|---|---|---|
| `full` | 1px `--wine-line` | `--wine-tint` | a full day allotted |
| `half` | 1px `--line` | `--sunk` | half day |
| `over` | 1px `--bad` | `--bad-bg` | two jobs on one crew |
| `blocked` | 1px `--warn` | `--warn-bg` | crew there, nothing to work on |
| `pull` | **1px dashed** `--wine` | `--card` | date derived from upstream |
| `ot` | 1px `--ok` | `--ok-bg` | overtime shift |
| `wknd` | 1px `--line2` | `--sunk`, `opacity .6` | weekend, no overtime |

Cell content: job code 10.5px/700 in the state's tone, then a 9px `--tx3`
sub-line (`full day`, `stopped`, `+3 h OT`, `after joinery`, `two jobs`, `free`).
Every cell is tappable and opens the allotment flow.

The five lanes, exactly:

| Lane | Capacity | Load | Target | Overtime |
|---|---|---|---|---|
| Joinery · Crew A | 6 fitters · saw 2 | 6 of 5 days (bad) | Target 18 Aug · misses on day work (bad) | OT Wed +3 h · Fri 8 h (ok) |
| Joinery · Crew B | 5 fitters · bench 1–3 | 3 of 5 days (ok) | Target 24 Aug · on track (ok) | — |
| Sofa & upholstery | 4 · upholstery bay | 2 of 5 days (warn) | Target 30 Aug · no fabric date (warn) | OT would be idle (bad) |
| Paint & polish | 3 · spray booth | 4 of 5 days (ok) | Target 16 Aug · on track (ok) | OT Fri 5 h (ok) |
| Site installation | 4 · two vans | 1 of 5 days (warn) | Target 20 Aug · provisional (wine) | — |

Day patterns (Sun→Sat) are in the prototype's `lanes` array; reproduce them
exactly. Note the shape of the story: Crew A is over on Thursday and recovers
with Wednesday evening plus a Friday shift; the sofa lane is `blocked` from
Tuesday; paint's Wednesday and Thursday are `pull`; install works Thursday only.

**"Waiting for a lane" strip** — `--sunk` footer of the same card. Title 12px/700
plus the rule in `--bad`: *"A lane will not take a job with no material or a
pending revision"*. Then flex-wrapped cards (`flex: 1 1 250px`), one per refused
job, bordered in their tone: JC-0344 (no BOM released), JC-0341 (6 boards short),
JC-0356 (BOM REV B waiting on sign-off).

### 3. Paperwork the shop is waiting on

Five rows. A 132px kind column (`Cutting list` · `Veneer press` · `Paint queue` ·
`Installation`) 11.5px/700 `--tx2`, then title and consequence sub-line, a state
pill, and a 32px outlined action button. `bad` rows take `--bad-bg`.

---

## Dashboard, right column (340px)

1. **Teams today** — title, then the note *"Crews and where they physically are.
   Who stands in each crew is the labour dashboard's business."* Five entries:
   name 11.5px/700 + state pill; what they are on 10.5px; a **7px track** with a
   tone-filled bar at the crew's load percentage; then capacity 10px `--tx3` and
   the **target** 10px/700 in tone on the same line.
   ⚠ **Chart rule:** the bar's fill never shares a line with text and never
   contains a label. Label above, fill in a full-width track.
2. **KPIs** — six rows, label + sub + value 16px/700 in tone: Jobs on the factory
   floor 11 · Waiting for a lane 3 (bad) · Pricing input owed 2 (warn) · Cutting
   lists live 7 · Overtime booked this week 16 h (ok) · Veneer sheets saved 9 (ok).
3. **Weekly planner** — as CLAUDE.md item 4. Marks on 10, 11, 12, 13, 14, 17, 18,
   20 August; agenda per selected day; empty state *"Nothing scheduled"*.
4. **My tasks** — as CLAUDE.md item 5. Seven seed tasks, lists Pricing · BOM ·
   Cutting · Teams.

---

## Working pages (`prdView: 'page'`)

Standard page template: title 20px/650 + sub (max 760px), a **stats strip**
(four cells, 21px/700 values, 1px `--line2` dividers), a **chip row** + secondary
+ wine primary, then the content. Right rail 300px: a **wine rule card** (the
page's business rule) and a context card.

Fifteen pages, in rail order:

| Key | Rail label | Badge | Content |
|---|---|---|---|
| `board` | Week board | 3 bad | one row per lane and per refused job; `Target out` column |
| `price` | Pricing input | 2 warn | estimator requests only |
| `bomb` | BOM input for budgeting | 2 warn | operations requests only |
| `bom` | BOM changes | 1 bad | revisions and which cutting lists they killed |
| `mat` | Material & reservations | 3 bad | **custom layout — see below** |
| `quote` | Supplier quotes | 2 warn | comparisons; cost and lead time visible |
| `cut` | Cutting lists | 7 wine | live sheets, what is on which saw |
| `press` | Veneer pressing | 2 ok | batches by veneer, sheets saved |
| `paint` | Paint & polish | 4 plain | booth days, pulled dates |
| `inst` | Site installation | 2 warn | provisional vs booked |
| `team` | Teams & labour | 1 bad | **custom layout — see below** |
| `ot` | Overtime & recovery | 2 ok | shifts by target and by cause |
| `rem` | Reminders | 3 bad | each row points at a crew waiting |
| `doc` | Documents | — | filed against the job card |

### `price` — Pricing input

**Requests arrive from the estimator and from nowhere else.** There is no
"new request" affordance on this page; the primary button *returns* input. Every
row carries a quote reference (`AMD-15402`). Rule card: *"Requests come from the
estimator only — not sales, not the client, not production itself."*

### `bomb` — BOM input for budgeting

**Raised by the operations manager only**, and asks for *standards*, not one
job's numbers: consumption per unit, wastage by process, labour standard per unit
or per linear metre. Rule card: *"Budgeting input is not pricing input."* The
side card lists what operations may ask for and ends with **"Job-specific hours
— that is the estimator"** in `bad`.

### `mat` — Material & reservations (custom layout)

Replaces the standard table with one row per material, `padding: 13px 16px`,
`--bad-bg` when short:

- Item name 12.5px/700 + job chip; detail line; **consequence line** 10.5px/650
  in tone (*"Crew B idles Sunday morning without the other six."*).
- **104px** right-aligned `FREE OF NEED` column, value 14px/700 in tone
  (`4 of 10`, `0 of 14`, `8 of 8`).
- **192px action stack**, and this is the part that matters:
  - **Reserve** (full width, 32px) — wine when there is something free to
    reserve, `--ok-bg`/`--ok` and non-interactive when already reserved,
    `--line2`/`--tx3` `not-allowed` when there is nothing to reserve.
  - **Request purchase** (wine outline) — *commits*: Purchase raises an order
    against the job card.
  - **Ask for prices** (`--line` outline) — *commits nothing*: asks the purchaser
    to come back with supplier quotes so lead time can be chosen.
- A `--sunk` footnote under the last row states that difference in those words.
  Keep it. It is the reason the two buttons are not one.

### `team` — Teams & labour (custom layout)

Five **expandable crew cards** (`prdCrewOpen` holds one key or null; Crew A open
by default). Collapsed header, `padding: 13px 16px`: a 34px wine-tint monogram
(`CA`, `CB`, `SU`, `PP`, `SI`), crew name 13px/700, sub `6 men · saw 2 and
benches 4–6 · Tubli`, target 10.5px/700 in tone, load pill, chevron. The open
card's border is wine.

Expanded, `padding: 0 16px 14px`:

- A `--sunk` header strip: `WHO IS IN THIS CREW` / `ON TODAY` (150px) / 62px spacer.
- One row per man: **28px circular monogram** tinted by his state, name 12px/650,
  a solid wine **`LEADER`** chip (9px/700) where applicable, trade 10.5px `--tx3`,
  **on-today** 11px/650 in tone at 150px, and a 62px **Move** button.
- Footer: dashed wine `＋ Assign labour to Crew A`.

Rosters — 22 men, reproduce exactly (Crew A 6, Crew B 5, sofa 4, paint 3, site 4).
State tones carry meaning: `wine` = on a job, `plain` = on other work, `warn` =
on leave / at risk, `ok` = free, `bad` = **idle** (the two sofa men from Tuesday).

Below the crews: a **"Not in a crew"** card, 1px dashed `--warn` on `--warn-bg`,
note *"3 men · a paid day producing nothing"*, and three cards — Faisal Rahman
(bench joiner, back from leave), Suresh Kumar (helper, new), Tariq Aziz (sprayer,
returned from the Riffa site). Rule: **a man with no crew cannot be given work**,
because everything on the week board is allotted to a crew, never to a person.

### `ot` — Overtime & recovery

One row per shift: crew and date, what is being worked, hours and head count,
**the target it recovers**, and **the cause of the slip** as a tone-coded column.
Includes a **refused** row (sofa crew Friday — nothing to work on). The side card
is the payload: four weeks by cause — BOM revision late 24 h (bad), material late
13 h (warn), client change 8 h (warn), nothing recoverable 1 refused.

---

## Create flows (`prdView: 'form'`)

Twelve flows. Every one has the same skeleton:

1. **Tab row** — twelve pills, active one solid wine.
2. Title 20px/650 + sub (max 720px).
3. **Gate card** — radius 16, wine-tinted and wine-bordered when unanswered, then
   re-tinted to the tone of the chosen answer. Contains a 26px icon badge
   (`?` → `✓` / `!` / `✕`), the gate question 13px/700, the reasoning 11.5px, and
   2–3 option buttons (`flex: 1`, radius 11, `padding: 10px 12px`).
4. **Fields card** — label 10.5px/700 uppercase `--tx3` above a 38px `--sunk`
   box. `flex: 1 1 210px`, or `flex: 1 1 100%` for wide fields. Hints 10.5px
   `--tx3` below.
5. Optional **lines table** (pricing, budgeting, quotes) or the **cutting-list
   builder** (see below).
6. **Banner** — full-width strip in the gate's tone, saying what will happen.
7. **Actions** — primary (wine when clear, **`--warn` fill when allowed-with-
   warning**, `--line2`/`not-allowed` when blocked), `Save as draft`, and a hint
   line on the right.

Right rail: the flow's **wine rule card**, and a **"Before it can take a slot"**
checks panel — four rows, each a 22px tone-tinted badge (`✓` / `!` / `✕`) plus
label and detail.

### The gate table — this is the enforcement layer

Each option carries its own tone. `ok` and `warn` make the primary **live**;
`bad` leaves it **dead**. Amber means *allowed, and it will show*.

| Flow | Gate question | Options → tone |
|---|---|---|
| `price` | What are you sending back? | Hours and quantities `ok` · A rough guess `warn` · **A price `bad`** |
| `bomb` | Is this a standard, or one job's numbers? | A standard `ok` · With a caveat `warn` · **One job's numbers `bad`** |
| `bom` | Where is the old cutting list right now? | **Still on saw 2 `bad`** · Back in the office `ok` · Never released `ok` |
| `res` | Is the BOM revision current? | REV B is current `ok` · **Revision pending `bad`** · Reserve anyway `warn` |
| `purch` | Are you committing, or asking? | Commit — buy it `ok` · Ask for prices first `ok` · **Not sure yet `bad`** |
| `quote` | Why is this not coming from stock? | Not held `ok` · Held stock reserved `ok` · Faster to buy `warn` |
| `cut` | Which BOM revision is this cut from? | REV C current `ok` · **REV B superseded `bad`** · **No BOM `bad`** |
| `press` | Batch it, or press alone? | Batch VP-0043 `ok` · Press alone `warn` · Wait for a batch `ok` |
| `allot` | Is the job clear to take a slot? | Material reserved · BOM current `ok` · **Material short `bad`** · Overload the crew `warn` |
| `ot` | What is this overtime actually recovering? | A slipped target `ok` · **A material delay `bad`** · **No stated cause `bad`** |
| `lab` | Which crew is he going into? | Crew B — trade matches `ok` · Crew A — already over `warn` · **Paint & polish — not his trade `bad`** |
| `inst` | Where has paint got to? | Paint complete `ok` · Paint booked Wednesday `warn` · **Paint not scheduled `bad`** |

**The blocked copy is not a validation message — it is the business rule.**
"You do not send a price." "Take the sheet off the saw first." "Overtime will not
fix this." "Trade does not match the crew." Keep the words.

### `cut` — Create a cutting list, item by item

The one flow with a real editor. Inside the fields card, above the banner: radius
12, 1px `--wine-line`.

- **Wine-tint header**: *"Parts, item by item"* + a live note
  `12 lines · 36 parts · 8 cut oversize for the press`, then
  **`Pull 12 parts from REV C`** (wine outline) and **`＋ Add a part`** (wine fill).
- **Column strip** on `--sunk`: `#` 22 · Part flex-1 · Material 124 · Qty 82 ·
  Length 56 · Width 50 · Press 52 · 26.
- **One row per part**, `padding: 8px 12px`. Rows flagged for the press take
  `--wine-tint`. Controls: **− / qty / ＋** steppers (22 × 24, radius 6; qty
  floors at 1), dimensions right-aligned tabular, a **PRESS** toggle (solid wine
  when on, 1px dashed `--line` and `—` when off), and a 26px **✕** to remove.
- **Empty state**: *"No parts yet. Pull them from the BOM, then adjust — the
  sheet is what the saw follows, so it is edited here and nowhere else."*
- **Totals footer** on `--sunk`, five cells, each label / value 14px/700 / note.
  Recomputed on every edit:

```
BOARD          = 2440 × 1220
oak boards     = ceil( Σ(qty·l·w) for 18mm oak MDF     / BOARD × 1.12 )   // 12% wastage
plain boards   = ceil( Σ(qty·l·w) for 18mm MDF plain   / BOARD × 1.06 )   // 6% wastage
veneer sheets  = ceil( Σ(qty·l·w) for press rows × 2   / BOARD × 1.12 )   // both faces
oversize parts = Σ(qty) where press
parts          = Σ(qty)
```

The twelve default parts are in `CUTDEF` and match the printed A4 exactly. The
press flag defaults true on every oak-veneer MDF part.

---

## The printable: cutting list at A4

794 × 1123 at `padding: 42px 44px 32px`. **It fits the page box exactly — do not
add content without removing some.**

- **Header**, 2px `#600131` bottom rule: kicker *"Al Maraya Decor · Joinery"*,
  title 23px, job line. Right: `CUT FROM BOM` and **`REV C · 11 Aug 2026`** in a
  solid wine chip, then in `#b42318`/700: **"Any other revision on this saw is
  scrap."**, then the sheet number.
- **Five-cell info strip** (client, area, material, finish, due out).
- **Parts table**, 12 rows at 26px, zebra `#fafbfc`. Columns `#` 30 · Part flex ·
  Material 118 · Qty 40 · Length 62 · Width 56 · Note 126. Oversize parts carry
  their oversize dimension and the note says why.
- **Boards and veneer issued** (wine-tint) and **After the saw** (four tick
  boxes: press Mon 08:00 · edging Tue · spray Wed · install Thu 20 Aug).
- **Three signatures**: Cut by · Checked against BOM REV C · Boards issued by.
- **Closing red rule**: *"If the BOM changes, this sheet is dead. Bring it back to
  the office and take the reissue."*

---

## State

Per-role store. Never shared with another role.

| State | Type | Purpose |
|---|---|---|
| `prdView` | `'dash' \| 'page' \| 'form'` | which view (default `dash`) |
| `prdPage` | page key | which working page (default `board`) |
| `prdForm` | flow key | which create flow (default `price`) |
| `prdGate` | int \| null | selected gate option; **null = unanswered** |
| `prdPgChip` | int | active filter chip |
| `prdRail` | bool | sidebar collapsed to the icon rail |
| `prdDrawer` | bool | phone nav drawer |
| `prdQA` / `prdQAp` | bool | quick actions, desktop / phone |
| `prdChatD` / `prdChatP` | bool | chat panel, desktop / phone |
| `prdWeekOpen` / `prdTasksOpen` | bool | desktop card collapse |
| `prdSubWeekOpen` / `prdSubTasksOpen` | bool | phone card collapse |
| `prdScope` | `'W' \| 'M'` | planner week or month |
| `prdOff` | int | period offset — **drives the week board and the planner** |
| `prdSel` | int | selected day (13) |
| `prdTaskTile` | tile key | Today / Urgent / All / Completed |
| `prdList` | list key \| null | task list filter |
| `prdTasks` | array | production's own task store |
| `prdCrewOpen` | crew key \| null | expanded crew (default `'A'`) |
| `prdCutRows` | array \| null | cutting-list builder; null = the BOM default |

Entering any create flow from anywhere **must reset `prdGate` to null**. A gate
that arrives pre-answered in the job's favour defeats the entire mechanism.

---

## API notes

Every screen is job-card centred. A job card needs, for this module: BOM revision
and its sign-off state, reserved and free material by store, the cutting lists
issued against it and which revision each was cut from, its press batch, its lane
allotments by crew and day, its target out date, and its derived paint and install
dates.

Requests are typed and carry their raiser: `pricing_input` (estimator only) and
`bom_budget_input` (operations only) must be distinguishable server-side — the
client must not be the thing that keeps them apart.

Overtime posts `{crew, date, hours, men, recovers_target, cause}`. `cause` is a
closed enum and is **required**. Hours are handed to the labour service; this
module never calculates pay.

**Explicitly not in scope for this role's API responses:** selling price, margin,
quote value, client totals, labour rates, any per-man pay figure. Material cost
and supplier quotes **are** in scope. Filter the rest server-side — do not rely
on the client to hide them.

---

## Screen map

| Screen | Prototype source |
|---|---|
| Whole module | `AMD Dashboard Directions.dc.html`, section `#19a` |
| Desktop 1440 | first frame in the 19a row |
| Phone 390 | second frame |
| Cutting list A4 | third frame |
| All logic | `prdVals()` in the logic class |

Shell, page template and form template are **shared with 17a (Purchase) and 18a
(Store)**. Build them once; 19a's own work is the week board, the two custom
pages, the twelve gates and the cutting-list builder.
