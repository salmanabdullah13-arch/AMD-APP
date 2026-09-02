# Handoff: Upholstery supervisor module (direction 20a)

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

The upholstery supervisor's whole module — Mahmood Habib, who runs the cutting
table, the sewing room, upholstery bays 1–2 and the finishing bench. One app,
three view modes off a single shell, structurally identical to Purchase (17a),
Store (18a) and Production (19a).

- **Dashboard** (`uphView: 'dash'`) — the inbox, the week board, the paperwork
  queue, stages today, KPIs, planner, tasks.
- **Working page** (`uphView: 'page'`) — twelve list pages, one template,
  driven by `uphPage`. Two pages break the template and are specified
  separately: **Crews & labour** and **Fabric & COM register**.
- **Create flow** (`uphView: 'form'`) — eleven flows, one template, driven by
  `uphForm`. Every flow opens with a **gate question** and the primary button is
  dead until it is answered.

Plus one printable: the **cutting & sewing ticket** at A4.

### Why the module is shaped this way

Upholstery is a **strict serial line**, not four parallel crews. Five stages in
one fixed order — frames & carcase → foam & cutting → sewing room → upholstery
bays 1–2 → finishing & QC — and **nothing overtakes**. A stage cannot be booked
until the stage before it has an end date. That single rule is why a late roll of
fabric moves five cells on the board instead of quietly going wrong on the day.

The second shaping force is **fabric**. Fabric is not a quantity like boards, it
is a *batch*: one dye lot, one nap direction, one repeat, cut in one lay. A
second cut later never matches. And when the fabric is the client's own (COM),
a shortfall cannot be bought out of — it has to be signed.

---

## The five design commitments

**They are the point of the module — do not dilute them.**

1. **Nothing overtakes.** A bay slot cannot start before sewing ends, sewing
   cannot start before cutting ends, cutting cannot start before the fabric is on
   site and inspected. The board enforces the *order*, not the dates. Stages that
   inherit their start from upstream render **dashed wine** (`pull`), never solid,
   and move when the upstream cell moves.
2. **One suite, one dye lot, one lay.** Two lots covered onto the same sofa read
   as a fault for the life of the piece. The fabric plan does not release unless
   the metres come off a single roll, and every panel of the suite is laid and cut
   together. This is the gate on the `plan` flow and the loudest line on the A4.
3. **COM shortfall is the client's risk, in writing, the same day.** We cannot
   buy the client's own weave. So we do not absorb a shortfall quietly and we do
   not cut hoping it works out. Until the note is signed the cutting table refuses
   the job — **nothing in this module can override it.**
4. **He returns metres, grades and hours, never a price.** Metres per seat, foam
   densities by part, sewing hours, bay hours. The estimator applies rates. He
   *does* see fabric and foam cost and supplier lead times — he takes those quotes
   himself — but never the selling price or the margin.
5. **Overtime buys hours, not material.** Every shift is booked against the target
   it recovers *and the cause of the slip*. Overtime on a stage with nothing to
   work on is refused — it is a paid idle day. (See the sewing lane: `OT would be
   idle`, tone `bad`.)

Corollary, stated on the pages that need it: **a spec is a standard, a plan is a
job.** The upholstery spec is the standing recipe for a *type* of piece (what a
3-seater takes). The fabric plan is one client's suite. **He owns the spec and edits it directly** — operations is notified on save, not
asked — which is precisely why the gate exists: a job-specific change must never
edit the standard, or every future quote inherits one client's taste.

---

## The six non-negotiables (CLAUDE.md)

All six are present and must stay present.

1. **Back button** — `‹` in the topbar, immediately left of Quick actions, in the
   same flex wrapper (`uphNotDash` / `uphBack`). Hidden on the dashboard root.
2. **Quick menu at the top** — one wine "Quick actions" button, popover on desktop
   (`uphQA`), bottom sheet on phone (`uphQAp`). **Eight items**, each opening a
   create flow. Never a row of separate buttons.
   Return pricing input `P` · Release a fabric plan `F` · Receive and inspect a
   roll `R` · Raise a COM shortfall note `C` · Build a foam schedule `O` · Ask
   purchase for prices `Q` · Allot a stage `A` · Move a man `M`.
3. **Collapsible side taskbar** — 230px sidebar (`uphRail === false`) collapsing
   to a **64px icon rail** (`uphRail === true`). On phone the `☰` button opens the
   same list as a slide-in drawer (`uphDrawer`) with a tap-away scrim. Rail icons
   carry a 6px tone dot instead of a count badge.
4. **Weekly planner** — collapsible card, count when collapsed. Week/Month switch
   (`uphScope`), `‹ Today ›` stepping, selection (`uphSel`) drives the agenda.
   **His own diary, not the week board** — do not merge them.
5. **My tasks** — collapsible, Apple Reminders model: smart tiles (Today / Urgent
   / All / Completed), lists Fabric · Pricing · Foam · Bays, tasks linkable to a
   job card. **Upholstery has its own task store** (`uphTasks`) — never shared.
6. **Floating chat box** — wine bubble bottom-right, unread badge `4`, panel
   titled "Upholstery bay". Opening it replaces the bubble so the two never
   overlap. Phone bubble sits at `right:16px; bottom:82px`, clear of the tab bar.

---

## Hard rules

- **Upholstery sees cost, never selling price.** Fabric cost per metre, foam cost
  per block, supplier quotes and lead times are visible (he chooses on them).
  Selling price, margin, client totals and quote values are not — not on a row,
  not in a summary, not on a printed ticket. **Filter them server-side.**
- **Sales never sees any of it.** Same fraud-prevention rule as the rest of
  AMD-APP: no price, no cost, no supplier name reaches a sales screen.
- **Labour is stages here, individuals in the labour dashboard.** Work is allotted
  to a stage and a number of days. The one exception is Crews & labour, which
  assigns *membership* — who stands at which stage. Wages, leave, attendance and
  rates belong to the labour dashboard; this module hands over **hours** and stops.
- **Density is a spec, not a preference.** Foam grade comes from the upholstery
  spec and only operations changes it. Nobody at the bench substitutes a softer
  block because the right one is late.
- Currency `BD 14.500` (3 decimals) where cost appears. Dates `DD MMM YYYY`.
- Working week is **Sunday to Thursday**. Friday and Saturday are `wknd` cells,
  dead grey, **unless overtime is booked**, which turns them green.
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
| Icon rail (collapsed) | 64px, buttons 40 × 36, radius 10 |
| Topbar | 62px, `--card`, 1px `--line` bottom, `z-index: 6` |
| Topbar controls | 38px tall, radius 10; back button 38 × 38 |
| Quick actions popover | 296–312px wide, radius 14, `--sh2`, `animation: sheetup .16s` |
| Dashboard padding | `18px 22px 26px`, `gap: 18px` |
| Right column | **340px** on the dashboard, **300px** on page and form views |
| Card radius | 16 (dashboard/page cards), 14 (phone cards), 12 (nested tables) |
| Phone topbar | `padding: 54px 14px 11px`, controls 40px tall |
| Phone content padding | `12px 14px 96px`, `gap: 11–12px` |
| Phone tab bar | 66px, four tabs: Board · Plans · Crews · Fabric |
| Phone chat bubble | 52 × 52 at `right:16px; bottom:82px` |
| Phone chat panel | `left:12px; right:12px; bottom:78px`, height 352, `animation: sheetup .18s` |

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
10px/700/.05em uppercase column headers. Tabular numerals on every quantity,
every metre and every dimension.

---

## Dashboard, left column (top to bottom)

### 1. Asked of you today

Wine-tinted header card, radius 16, 1px `--wine-line`. Count pill `5 open` in
solid wine. Five rows, `padding: 12px 18px`; a row whose deadline tone is `bad`
takes a `--bad-bg` background. Row structure, left to right:

1. **Kind chip** — `PRICING` (wine) · `FABRIC` (bad) · `COM` (bad) · `MATERIAL`
   (warn). 9.5px/700, `.06em` tracking, radius 6.
2. Title 12.5px/650, **who it is from** 11px `--tx2`, then the **need line**
   11px/650 in its tone.
3. **Due** — right-aligned, 11.5px/700 in tone.
4. **Action button** — 32px, wine fill, radius 9. Opens the matching flow.
   On phone the button goes full width, 38px, under the text.

The five rows are the module's premise; keep all five and keep the wording:

| Kind | Title | From | Due | Action → flow |
|---|---|---|---|---|
| PRICING | Pricing input — 12-seat majlis, wall to wall | Estimator — Sara Khalifa · quote AMD-15409 | Today 16:00 | Return input → `price` |
| FABRIC | Client changed the fabric on the Budaiya suite — Nova 04 to Sahara 12 | Sales — Noor Al Sayed · 12 Aug | Now | Accept and reissue → `spec` |
| COM | Client's own roll landed 6 m short — Amwaj dining chairs | Store — Jassim Abdulla | Today | Raise the note → `com` |
| MATERIAL | Grade 4 HR foam short — 8 seat blocks for the Seef banquette | Store — Jassim Abdulla | Today | Reserve or quote → `res` |
| MATERIAL | Two supplier quotes back for 35kg HR foam | Purchase — Rashid Al Doseri | 14 Aug | Compare quotes → `quote` |

Need lines, verbatim: *"She needs metres per seat, foam grades and sewing hours.
Not a price."* · *"UT-0352-A is on the cutting table right now, laid from Nova
04."* · *"COM. We cannot buy more. Nobody cuts until the shortfall is signed."* ·
*"Reserve from Riffa or take supplier quotes before Sunday."* · *"Pick one on
lead time or the banquette cannot be filled."*

### 2. The week board

Radius 16, 1px `--line`, `--sh2`. Header sub: *"Five stages in one order.
**Nothing overtakes** — a stage cannot start before the one before it has an end
date. Green Friday cells are overtime, booked against the target they recover."*
Right of the header: `‹` / `This week` / `›` (30px controls) stepping `uphOff`.

**Column header strip** — `--sunk`, `padding: 8px 18px`: a 152px spacer labelled
`STAGE`, then seven flex-1 day labels `Sun 9 … Sat 15`, today (13) in wine.

**Five stage rows**, `padding: 10px 18px`, `align-items: stretch`:

- **Label column, 152px fixed.** Stage name 12px/700 · capacity 10.5px `--tx3` ·
  load pill · **target line** 10px/700 in tone · **overtime badge**
  (inline-block, nowrap, radius 6, tone-tinted) when one exists.
- **Seven day cells**, `flex: 1`, `align-self: stretch`, `min-height: 46px`,
  radius 9, `padding: 5px 7px`. ⚠ **Do not give the cells a fixed `height`** — an
  explicit cross size defeats `stretch` and the grid stops reading as a grid when
  the label column grows.

Cell states — this is the whole vocabulary:

| State | Border | Background | Meaning |
|---|---|---|---|
| `full` | 1px `--wine-line` | `--wine-tint` | a full day allotted |
| `half` | 1px `--line` | `--sunk` | half day |
| `over` | 1px `--bad` | `--bad-bg` | stopped / two jobs on one stage |
| `blocked` | 1px `--warn` | `--warn-bg` | men there, nothing to work on |
| `pull` | **1px dashed** `--wine` | `--card` | start inherited from upstream |
| `ot` | 1px `--ok` | `--ok-bg` | overtime shift |
| `wknd` | 1px `--line2` | `--sunk`, `opacity .6` | weekend, no overtime |
| `free` | 1px dashed `--line` | `--card` | nothing allotted |

Cell content: job code 10.5px/700 in the state's tone (or `free` / `—` in
`--tx3`), then a 9px `--tx3` sub-line. Every cell is tappable and opens `allot`.
Each cell carries a `title` of the form `Wed — JC-0352 · OT 3 h re-lay`.

The five stages, exactly:

| Stage | Capacity | Load | Target | Overtime |
|---|---|---|---|---|
| 1 · Frames & carcase | 3 · frame shop | 3 of 5 days (ok) | Target 22 Aug · on track (ok) | — |
| 2 · Foam & cutting | 2 · cutting table | 5 of 5 days (bad) | Target 18 Aug · misses, fabric changed (bad) | OT Wed +3 h · Fri 6 h (ok) |
| 3 · Sewing room | 4 machinists · 3 machines | 2 of 5 days (warn) | Target 20 Aug · pulls from cutting (warn) | OT would be idle (bad) |
| 4 · Upholstery bays 1–2 | 6 · bays 1 and 2 | 3 of 5 days (ok) | Target 24 Aug · pulls from sewing (wine) | — |
| 5 · Finishing & QC | 2 · finishing bench | 1 of 5 days (warn) | Target 26 Aug · provisional (warn) | — |

Day patterns (Sun→Sat) are in the `lanes` array; reproduce them exactly. The
story they tell: cutting is `over` on Tuesday (*stopped — old batch*), recovers
with a Wednesday `ot` (*OT 3 h re-lay*) and a Friday `ot` shift, and is
`blocked` Thursday on the COM shortfall; sewing is `blocked` Wednesday and
Thursday (*waiting on cut*); the bays run three `pull` cells (*after sewing*,
*frames curing*); finishing has one working day all week.

**"Waiting for a stage" strip** — `--sunk` footer of the same card, note
*"3 suites · none can be booked today"*. Flex-wrapped cards (`flex: 1 1 250px`),
bordered in their tone:

| Job | Why | Tone | Opens |
|---|---|---|---|
| JC-0364 — Juffair Apt 9, 6 buttoned headboards | No spec released yet — operations still has it | bad | `com` |
| JC-0361 — Amwaj Villa 12, 8 dining chairs | COM roll 6 m short. Signed note before anyone cuts. | bad | `com` |
| JC-0367 — Hidd Café, 14 bench seats | Foam grade not signed off | warn | `foam` |

### 3. Paperwork the floor is waiting on

Note *"One to reissue, two blocked"*. Five rows: a kind column (`Fabric plan` ·
`Foam schedule` · `Sewing queue` · `Bay booking`) 11.5px/700 `--tx2`, then title
and consequence sub-line, a state pill, and a 32px outlined action button. `bad`
rows take `--bad-bg`.

| Kind | Title | Sub | State | Action → flow |
|---|---|---|---|---|
| Fabric plan | UT-0352-B — Budaiya sofa suite | Sahara 12, dye lot 4471 · supersedes UT-0352-A, still on the table | Reissue now (bad) | Release → `plan` |
| Foam schedule | FS-0358 — Seef banquette, 8 seat blocks | 35kg HR seats · 8 short, reserve or take quotes | Blocked (warn) | Open → `foam` |
| Sewing queue | JC-0358 covers — 22 panels, piped | Machines free Tuesday. Cutting finishes Monday. | Queued (ok) | Schedule → `allot` |
| Bay booking | JC-0358 — bay 1, three days | Frames cure until Wednesday. Bay slot provisional. | Provisional (warn) | Confirm → `allot` |
| Fabric plan | UT-0361-A — Amwaj dining chairs | Cannot release — client's own roll is 6 m short | Blocked (bad) | Open → `com` |

---

## Dashboard, right column (340px)

1. **Stages today** — five entries: stage name 11.5px/700 + state pill; what they
   are on 10.5px; a **7px track** with a tone-filled bar at the stage's load
   percentage; then capacity 10px `--tx3` and the **target** 10px/700 in tone on
   the same line. Rows: Frames (On track, 60%) · Foam & cutting (Stopped, 100%,
   bad) · Sewing (Idle Wed, 40%, warn) · Bays (On track, 60%) · Finishing (Light,
   20%, warn). Clicking any row opens the Crews & labour page.
   ⚠ **Chart rule:** the bar's fill never shares a line with text and never
   contains a label. Label above, fill in a full-width track.
2. **KPIs** — six rows, label + sub + value 16px/700 in tone:
   Suites on the floor 9 · Waiting for a stage 3 (bad) · Pricing input owed 2
   (warn) · Fabric plans live 6 · Overtime booked this week 11 h (ok) ·
   **Metres saved by single lay 38 m** (ok).
3. **Weekly planner** — as CLAUDE.md item 4. Marks on 10, 11, 12, 13, 14, 17, 18,
   20 August (dot width scales with count, capped at 3). Agenda per selected day,
   default 13; empty state *"Nothing scheduled"*. Month view is a 35-cell grid
   offset by −5.
4. **My tasks** — as CLAUDE.md item 5. Six seed tasks, lists Fabric · Pricing ·
   Foam · Bays. Three are Today+Urgent (the Nova 04 lay, the 16:00 pricing input,
   the COM signature); one is done (piping check, struck through).

---

## Working pages (`uphView: 'page'`)

Standard page template: title 20px/650 + sub (max 760px), a **stats strip** (four
cells, 21px/700 values, 1px `--line2` dividers), a **chip row** + secondary +
wine primary, then the content. Right rail 300px: a **wine rule card** (the
page's business rule) and a context card. On phone the stats become a 2×2 grid
and rows become cards.

Twelve pages, in rail order. **Supplier quotes and Sewing room were cut** — the quote comparison folded into the register as a strip beside the rows it decides, and the sewing room is scheduled as one room, which the week board's lane 3 already shows:

| Key | Rail label | Icon | Badge | Content |
|---|---|---|---|---|
| `board` | Week board | ▦ | 3 bad | one row per suite; stage, target, state |
| `price` | Pricing input | ∑ | 2 warn | estimator requests only |
| `spec` | Upholstery spec | ⊟ | 2 warn | standards by piece type, revisions |
| `plan` | Fabric plans | ⌗ | 6 wine | live tickets and which are superseded |
| `foam` | Foam schedules | ▣ | 3 warn | density by part, blocked schedules |
| `fab` | Fabric & COM register | ▤ | 4 bad | **custom layout — see below** |
| `bay` | Upholstery bays | ◧ | 3 plain | bays 1 and 2, slot dates |
| `fin` | Finishing & QC | ◐ | 2 plain | wrap and label |
| `team` | Crews & labour | ☷ | 1 bad | **custom layout — see below** |
| `ot` | Overtime & recovery | ◑ | 2 ok | shifts by target and by cause |
| `rem` | Reminders | ⏱ | 3 bad | each row points at a stage waiting |
| `doc` | Documents | ▨ | — | tickets and specs filed against the job |

Ten pages carry fully specified content in the prototype: `board`, `price`,
`spec`, `plan`, `foam`, `fab`, `fin`, `team`, `ot`, `rem`. `bay` and `doc`
inherit the `board` shape. Reproduce the specified ten exactly.

### `board` — Week board (list form)

Sub: *"Nothing overtakes. A stage can only be booked once the stage before it has
an end date, so a late roll of fabric moves everything after it instead of
quietly going wrong."*
Stats: Stages 5 · Days booked 14 of 25 · Blocked cells 4 (bad) · Overtime 11 h
(ok). Chips: All stages · Blocked · Overtime · Pulls from another stage.
Primary **Allot work**, secondary **Print the week**.
Rule card: **"Nothing overtakes"** — *"A bay slot cannot start before sewing ends,
sewing cannot start before cutting ends, and cutting cannot start before the
fabric is on site and inspected. The board enforces the order rather than
trusting the dates."*
Seven rows, JC-0352 / 0358 / 0361 / 0349 / 0364 / 0367 / 0345, with `REISSUED`
and `COM` tags on the two `bad` rows.

### `fab` — Fabric & COM register (custom layout)

Sub: *"Every roll on the floor with the only three numbers that matter — landed,
held against a job, free. Client's own material is flagged, because a shortfall
there is not something we can buy our way out of."*
Stats: Rolls on the floor 23 · Held against a job 14 · Short of need 3 (bad) ·
COM rolls 4 (warn). Rule card: **"One suite, one dye lot."**
Side card **"Fabric cost — no selling price"**: Sahara 12 BD 14.500/m · Nova 04
BD 11.200/m · 35kg HR foam BD 22.000/block (warn) · COM `—`.

Six rows, `padding: 13px 16px`, `--bad-bg` when short:

- Item name 12.5px/700 + job chip; detail line; **consequence line** 10.5px/650
  in tone.
- Right-aligned `FREE OF NEED` column, value 14px/700 tabular in tone
  (`46 of 26 m`, `28 of 34 m`, `0 of 8`).
- **192px action stack**, and this is the part that matters:
  - **Reserve** (full width, 32px) — wine when there is something free to
    reserve; `--ok-bg`/`--ok` and non-interactive when already reserved
    (label `Reserved`); `--line2`/`--tx3` `not-allowed` when there is nothing
    (label `Nothing to reserve`).
  - **Request purchase** (wine outline) — *commits*: Purchase raises an order
    against the job card.
  - **Ask for prices** (`--line` outline) — *commits nothing*.

Rows, verbatim:

| Item | Job | Free of need | Consequence | Reserve |
|---|---|---|---|---|
| Sahara 12 upholstery fabric · 140cm | JC-0352 | 46 of 26 m (ok) | Roll R-4471 held against the job card since 12 Aug. | Reserved |
| Nova 04 upholstery fabric · 140cm | JC-0352 | 23 m held (warn) | Release the hold and return it. The old lay is still on the table. | Release the hold |
| COM — client's own weave · 130cm | JC-0361 | 28 of 34 m (bad) | Client's material. We cannot buy more — this needs a signed note. | Nothing to reserve |
| 35kg HR foam block 2000×1000×100 | JC-0358 | 0 of 8 (bad) | Two quotes back — 4 and 9 days lead time. | Nothing to reserve |
| 21kg foam sheet 25mm | JC-0349 | 14 of 14 (ok) | Reserved against the job card since 09 Aug. | Reserved |
| Dacron fibre wrap 400g | Bay stock | 6 of 11 rolls (warn) | Enough for the cushions, not for the banquette as well. | Reserve the 6 |

### `team` — Crews & labour (custom layout)

Sub: *"Who stands in each stage today. Moving a man is allowed here; hiring, wages
and leave are the labour dashboard's business, and hours hand over to it rather
than being priced here."*
Stats: Men on the floor 17 · Crews 5 · Idle from Wednesday 2 (bad) · Not in a crew
3 (warn). Rule card: **"Hours, never rates"** — *"You move men and return hours.
What those hours cost belongs to labour and accounts — it is not shown here, and
it is never shown to sales."*

Five **expandable stage cards** (`uphCrewOpen` holds one key or null; `'F'` open
by default). Collapsed header, `padding: 13px 16px`: a 34px wine-tint monogram
(`FR`, `FC`, `SR`, `UB`, `FQ`), stage name 13px/700, sub (`3 men · frame shop ·
Tubli`), target 10.5px/700 in tone, load pill, chevron. The open card's border is
wine.

Expanded: a `--sunk` header strip (`WHO IS IN THIS CREW` / `ON TODAY` 150px /
62px spacer), then one row per man — **28px circular monogram** tinted by state,
name 12px/650, a solid wine **`LEADER`** chip where applicable, trade 10.5px
`--tx3`, on-today text 11px/650 in tone at 150px, and a 62px **Move** button.
Footer: dashed wine `＋ Assign labour to <stage>`.

Rosters — **17 men**, reproduce exactly:

- **Frames & carcase (3)** — Vinod Menon (frame maker, leader, JC-0358, wine),
  Sabu Varghese (frame maker, JC-0358, wine), Rakesh Nair (helper, webbing and
  straps, plain).
- **Foam & cutting (2)** — Shahul Hameed (cutter, leader, *Stopped — old lay on
  the table*, bad), Basheer Kutty (foam cutter, JC-0349 cushion blocks, wine).
- **Sewing room (4)** — Reshma Pillai (machinist, room leader, covers done, warn),
  Sunita Devi (machinist, *Idle from Wednesday — nothing cut*, bad), Mary
  Fernandes (machinist, piping and welting, wine), Nizar Ahmed (overlocker, *Idle
  from Wednesday*, bad).
- **Upholstery bays 1–2 (6)** — Ramesh Babu (bay 1 leader, waiting on covers,
  warn), Salim Khan (waiting on covers, warn), Jomon Joseph (JC-0349, wine), Arun
  Kumar (bay 2, JC-0349, wine), Ashraf Ali (back from the Hidd site today, ok),
  Manoj Pillai (helper, foam and fibre to the bays, plain).
- **Finishing & QC (2)** — Ibrahim Yusuf (finisher, leader, JC-0349 QC Wednesday,
  plain), Deepak Shetty (finisher and packer, free Sun to Tue, ok).

State tones carry meaning: `wine` = on a job, `plain` = on other work, `warn` =
at risk / waiting, `ok` = free, `bad` = **idle**.

Below the crews: a **"Not in a crew"** card, note *"3 men · assign them before
Sunday"*, and three cards — Faisal Rahman (machinist, back from leave today, ok),
Suresh Kumar (helper, new — started Sunday, warn), Tariq Aziz (upholsterer,
returned from the Riffa site, ok). Rule: **a man with no stage cannot be given
work**, because everything on the board is allotted to a stage, never to a person.

### `fab` — the folded-in quotes strip

Below the six material rows, inside the same page: a card titled **"Quotes back on
the short rows"**, note *"Pick on the date, then say in one line why the cheaper
quote lost."* Three rows — supplier 12px/700, the item 11px `--tx2`, the
consequence line 10.5px/650 in tone, then a 74px lead time in tone, a 92px
right-aligned unit cost, and a 30px outlined **Ask again**. Footnote: *"There is
no separate quotes page. The choice here is a lead-time choice — nine days on
foam costs a bay slot and a target date, four days does not — so it sits beside
the rows it decides."*

| Supplier | Item | Lead | Cost | Consequence |
|---|---|---|---|---|
| Gulf Foam | 35kg HR foam block · 8 blocks | 4 days | BD 22.000 | Holds the banquette target. Picked. (ok) |
| Bahrain Foam Co | 35kg HR foam block · 8 blocks | 9 days | BD 18.500 | Cheaper by BD 28.000, and it costs six days and a bay slot. (warn) |
| Gulf Foam | Dacron fibre wrap 400g · 11 rolls | 5 days | BD 6.200 | Cushions only — no target at risk. (plain) |

### ~~`quote` — Supplier quotes~~ — cut, folded above

Sub: *"Quotes he takes himself, because the choice is a lead-time choice before it
is a price choice. Cost per unit is visible here; what we sell it for is not."*
Rule card: **"Lead time before price"** — *"Nine days on foam costs a bay slot and
a target date; four days does not. Pick on the date first, and say in one line why
the cheaper quote lost."*
Five rows with lead time and unit cost columns: Gulf Foam 4 days BD 22.000
(Fastest, ok) · Bahrain Foam Co 9 days BD 18.500 (Cheaper, warn) · Al Rashid
Textiles 2 days BD 14.500 (Picked, `ORDERED`) · Dacron wrap 5 days BD 6.200 ·
Piping cord 1 day BD 0.850. Side card **"What a slip costs in days"**: the 9-day
foam quote is `+6 days` on the banquette target (bad).

### `sew` — Sewing room queue

Sub: *"Three machines and an overlocker. The queue is fed by the cutting table and
nothing else, so an idle machine is almost always a cutting problem, not a sewing
one."* Rule card: **"The queue is fed by the table"** — sewing never gets a start
date of its own. Side card lists the four machines; **Machine 2 and the
overlocker are `Idle` from Wednesday (bad)** — the same fact the board shows as
two `blocked` cells.

---

## Create flows (`uphView: 'form'`)

Ten create flows (the *Ask for prices* flow survives the cut of its page), tab order: Pricing input · Upholstery spec · Fabric plan · Foam
schedule · COM sign-off · Reserve material · Request purchase · Ask for prices ·
Crews & labour · Allot a stage. Every one has the same skeleton:

1. **Tab row** — pills, active one wine-tinted with a wine border.
2. Title 20px/650 + sub (max 720px).
3. **Gate card** — radius 16, wine-tinted and wine-bordered when unanswered, then
   re-tinted to the tone of the chosen answer. A 26px icon badge (`?` → `✓` / `!`
   / `✕`), the question 13px/700, the reasoning 11.5px, and 2–3 option buttons
   (`flex: 1 1 180px`, radius 11, `padding: 10px 12px`), each with a sub-label.
   On phone the options stack full width.
4. **Fields card** — label 10.5px/700 uppercase `--tx3` above a 38px `--sunk`
   box. `flex: 1 1 220px`, or `1 1 100%` when the value is longer than 34 chars.
   Hints 10.5px `--tx3` below.
5. Optional **lines table** (pricing, quotes) or the **fabric-plan builder**.
6. **Banner** — full-width strip in the gate's tone, saying what will happen.
7. **Actions** — primary (wine when clear, `--line2`/`not-allowed` and labelled
   **Blocked** when the gate answer is `bad`), `Save as draft`, and a hint line on
   the right in the flow's hint colour.

Right rail: the flow's **wine rule card**, and a **"Before it can take a slot"**
checks panel — four rows, each a 20px tone-tinted badge (`✓` / `!` / `✕`) plus
label and detail.

### The gate table — this is the enforcement layer

Each option carries its own tone. `ok` and `warn` make the primary **live**;
`bad` leaves it **dead** and swaps the banner for *"This cannot be sent while the
gate above is unanswered or blocked."*

| Flow | Gate question | Options → tone |
|---|---|---|
| `price` | Which quote is this input for? | AMD-15409 `ok` · AMD-15398 already returned `warn` · **No reference yet `bad`** |
| `spec` | Is this a standard spec or one job's change? | Standard spec `warn` — he can save it, and it reprices every future quote · Job change `ok` · **Not decided `bad`** |
| `plan` | Is the fabric on site, inspected, and one dye lot? | One roll, one lot `ok` · **Two lots `bad`** · **Not received `bad`** |
| `foam` | Is every grade on this schedule in stock or quoted? | All in stock `ok` · Some quoted `warn` · **Nothing yet `bad`** |
| `com` | What has the client agreed to? | Sending 6 m more `ok` · Accepts a join `warn` · **Nothing agreed `bad`** |
| `res` | What is this for? | JC-0358 banquette `ok` · Bay stock `warn` · **Not chosen `bad`** |
| `purch` | Has a supplier been picked? | Gulf Foam 4 days `ok` · Bahrain Foam 9 days `warn` · **Not picked `bad`** |
| `quote` | What do you need to know? | Price and lead time `ok` · Price only `warn` · **Not stated `bad`** |
| `lab` | Why is this man moving? | Stage is idle `ok` · Recovering a target `warn` · **No reason given `bad`** |
| `allot` | Has the stage before this one finished? | Yes, finished `ok` · Curing until Wed `warn` · **Not started `bad`** |

**The blocked copy is not a validation message — it is the business rule.**
"Nobody cuts." "Cannot release." "Ask for prices instead." "Cannot book." Keep
the words. The banners matter as much:

- `plan` — *"Releasing this kills UT-0352-A. The old lay comes off the table
  before the new one goes on."* (bad)
- `com` — *"Until this is signed the cutting table will not accept JC-0361.
  Nothing in this module can override it."* (bad)
- `res` — *"Reserve holds stock. Request purchase commits money. Ask for prices
  commits nothing."* (wine)
- `purch` — *"This commits. If you only want to know the price, use Ask for
  prices instead."* (warn)
- `quote` — *"Nothing is committed by sending this. No order is raised."* (plain)
- `price` — *"No rate, no price, no margin on this form — those are hers."* (wine)
- `lab` — *"Hours go to the labour dashboard. No rate is entered or shown
  here."* (wine)
- `allot` — *"Frames cure until Wednesday. This slot is provisional until they are
  signed off."* (warn)

`price` and `quote` carry a **lines table**: the pricing flow lists the five
stages with crew and hours and a **Rate column that is `—` on every row**
(`--tx3`) — that empty column is the point, do not remove it. The quote flow
lists the three suppliers with lead time and unit cost.

### `plan` — Fabric plan, panel by panel

The one flow with a real editor. Inside the fields card, above the banner: radius
12, 1px `--wine-line`.

- **Wine-tint header**: *"Panels to cut"* + a live note
  `Laid on a 140cm roll · nap runs down on N lines · repeat 320mm`, then
  **`Pull 12 panels from the spec`** (wine outline) and **`＋ Add a panel`**
  (wine fill).
- **Column strip** on `--sunk`: `#` 22 · Panel flex-1 · Fabric 132 · Qty 74 ·
  Length 56 · Width 50 · Nap 96.
- **One row per panel**, `padding: 8px 12px`. Rows with nap set take
  `--wine-tint`. Controls: **− / qty / ＋** steppers (22 × 24 desktop, 30 × 30
  phone; qty floors at 1), dimensions right-aligned tabular, a **nap toggle**
  (solid wine `↓ nap` when on, outlined `free` when off), and a **✕** to remove.
  Fabric name is coloured by material: Sahara 12 wine · Calico lining plain ·
  COM warn.
- **Empty state**: *"No panels yet. Pull them from the spec, then adjust — the
  ticket is what the table follows, so it is edited here and nowhere else."*
- **Totals footer** on `--sunk`, five cells, label / value 15px/700 / note.
  Recomputed on every edit:

```
ROLL          = 1400 mm usable
across        = max(1, floor(ROLL / panel.width))
layMM         = Σ ceil(qty / across) × length
napRows       = panels with nap set
napCount      = Σ qty over napRows
repeatMM      = napRows.length × 320          // one repeat per nap-matched line
totalM        = (layMM × 1.06 + repeatMM) / 1000   // 6% wastage
panelCount    = Σ qty
```

Cells: **Panels** (count + line count) · **Single lay** (`layMM/1000` m, *on 140cm
roll*) · **Nap-matched** (count, *N lines run ↓*, wine) · **Repeat allowance**
(`repeatMM/1000` m, *320mm per nap line*, warn) · **Fabric to cut** (`totalM`,
*incl. 6% wastage*) — **tone flips to `bad` when totalM exceeds 46**, the metres
on roll R-4471. That flip is the whole point of the calculator: it tells him the
suite no longer comes off one roll.

The twelve default panels are in `PANELDEF` and match the printed A4 exactly.
Nap defaults **on** for every shaped panel and **off** for boxings, borders and
the calico skirt.

---

## The printable: cutting & sewing ticket at A4

794 × 1123 at `padding: 42px 44px 32px`, shown in the canvas scaled `.75` inside a
596 × 843 frame. **It fits the page box exactly — do not add content without
removing some.**

- **Header**, 2px `#600131` bottom rule: kicker *"Al Maraya Decor · Upholstery"*,
  title 23px *"Cutting & sewing ticket"*, job line *"JC-0352 · Budaiya Villa —
  4-seater sofa + 2 armchairs · bay 1"*. Right: `CUT FROM SPEC` and
  **`SPEC REV B · dye lot 4471`** in a solid wine chip, then in `#b42318`/700:
  **"One dye lot only. Two lots on one suite is scrap."**, then
  *"Ticket UT-0352-B · issued 13 Aug 2026"*.
- **Five-cell info strip**: Job card · Suite · Fabric · Dye lot · Bay.
- **Panels table** — sub-line *"Nap runs one way on every panel marked ↓ — check
  it before the knife. Repeat is matched across seat and back."* Wine-tint header
  row. Columns `#` 30 · Panel flex · Fabric 118 · Qty 40 · Length 62 · Width 56 ·
  Note 126. Twelve rows at 23px, zebra `#fafbfc`. Notes carry the reason, not just
  the flag: *Nap ↓ · one piece, no join* · *Straight · railroad allowed* ·
  *Nap ↓ · cut oversize 20mm* · *Lining · not visible*.
- **Fabric and foam issued** (wine-tint), footnote *"Every metre on this ticket
  comes off roll R-4471, one dye lot, cut in a single lay. Any shortfall stops —
  do not open a second roll."* Beside it, **After cutting** (250px): four tick
  boxes — sew covers 16 Aug · foam cut and wrapped 16 Aug · bay 1 cover the suite
  17 Aug · QC, wrap and label 20 Aug.
- **Three signatures**: Cut by · Sewn by · Checked by (*Supervisor · before the
  bay*).
- **Closing red rule**: *"If the fabric batch or the spec changes, this ticket is
  dead. Bring it back and take the reissue."*

The `Fabric to cut` figure on the ticket is the **live** `totalM` from the
builder — the print and the editor must never disagree.

---

## State

Per-role store. Never shared with another role.

| State | Type | Purpose |
|---|---|---|
| `uphView` | `'dash' \| 'page' \| 'form'` | which view (default `dash`) |
| `uphPage` | page key | which working page (default `board`) |
| `uphForm` | flow key | which create flow (default `price`) |
| `uphGate` | int \| null | selected gate option; **null = unanswered** |
| `uphPgChip` | int | active filter chip |
| `uphRail` | bool | sidebar collapsed to the icon rail |
| `uphDrawer` | bool | phone nav drawer |
| `uphQA` / `uphQAp` | bool | quick actions, desktop / phone |
| `uphChat` / `uphChatP` | bool | chat panel, desktop / phone |
| `uphWeekOpen` / `uphTasksOpen` | bool | desktop card collapse |
| `uphSubWeek` / `uphSubTasks` | bool | phone card collapse |
| `uphScope` | `'W' \| 'M'` | planner week or month |
| `uphOff` | int | period offset — **drives the week board and the planner** |
| `uphSel` | int | selected day (default 13) |
| `uphTaskTile` | tile key | Today / Urgent / All / Completed |
| `uphList` | list key \| null | task list filter |
| `uphTasks` | array | upholstery's own task store |
| `uphCrewOpen` | crew key \| null | expanded stage card (default `'F'`) |
| `uphCutRows` | array \| null | fabric-plan builder; null = the spec default |

Entering any create flow from anywhere **must reset `uphGate` to null** — every
`go(f)` in the prototype does. A gate that arrives pre-answered in the job's
favour defeats the entire mechanism.

---

## API notes

Every screen is job-card centred. A job card needs, for this module: the
upholstery spec revision it was quoted from, the fabric assigned to it with
**roll id and dye lot**, whether that fabric is COM, metres landed vs metres
needed, foam grades by part and their stock/quote state, the fabric plan tickets
issued against it and which spec revision each was cut from, its stage
allotments by stage and day, its target out date, and the derived start dates of
every downstream stage.

**Fabric is a batch, not a quantity.** A metre count with no roll id and no dye
lot is not a usable answer to "can we cut this suite" — model the roll.

**COM is a flag with teeth.** `is_com` must gate the cutting-table transition
server-side, and clear only on a signed shortfall note carrying the client's
chosen option (more material / a join / fewer pieces) and the sales
countersignature.

Requests are typed and carry their raiser: `pricing_input` (estimator only) and
`spec_revision` (operations only) must be distinguishable server-side.

Overtime posts `{stage, date, hours, men, recovers_target, cause}`. `cause` is a
closed enum and is **required**. Hours are handed to the labour service; this
module never calculates pay.

**Explicitly not in scope for this role's API responses:** selling price, margin,
quote value, client totals, labour rates, any per-man pay figure. Fabric and foam
cost and supplier quotes **are** in scope. Filter the rest server-side — do not
rely on the client to hide them.

---

## Screen map

| Screen | Prototype source |
|---|---|
| Whole module | `AMD Dashboard Directions.dc.html`, section `#20a` |
| Desktop 1440 | first frame in the 20a row |
| Phone 390 | second frame |
| Cutting & sewing ticket A4 | third frame |
| All logic | `uphVals()` in the logic class |

Shell, page template and form template are **shared with 17a (Purchase), 18a
(Store) and 19a (Production)**. Build them once; 20a's own work is the
five-stage serial board, the two custom pages, the ten gates, and the fabric-plan
builder with its nap and repeat arithmetic.

## Files in this package

- `README.md` — this spec.
- `AMD Dashboard Directions.dc.html` — the full prototype canvas; 20a is the top
  section.
- `support.js` — the runtime the canvas loads. Drop both in the same folder and
  open the HTML file in a browser; no build step, no network.
