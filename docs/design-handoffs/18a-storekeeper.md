# Handoff: Store keeper module (direction 18a)

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
   A component library default is not a reason to change the design.
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
styles into production. Map the tokens onto the codebase's styling system. The
*output on screen* must match; the code behind it should follow the codebase's
own conventions.

**Definition of done:** put your build and the prototype frame side by side at
the same width. They should be difficult to tell apart.

---

## Overview

The Store Keeper's whole module in AMD-APP: one app, three view modes off a
single shell, identical in structure to Purchase (17a). The store sits between
Purchase and Production — goods arrive against a purchase order, get counted,
put away, held for a job, and issued to the team that needs them.

Three views share the shell:

- **Dashboard** (`stkView: 'dash'`) — the five-step day, a fixed widget slot,
  stale holds, three stores, movements, KPIs, planner, tasks.
- **Working page** (`stkView: 'page'`) — twelve list pages, one template, driven
  by `stkPage`.
- **Create flow** (`stkView: 'form'`) — seven creation forms, one template,
  driven by `stkForm`.

### What makes this module different from Purchase

Three design commitments, each answering a stated failure in the current
operation. **They are the point of the module — do not dilute them.**

1. **Location leads every row.** Not the item code, not the description — where
   the thing physically is. Every stock row, pick list and put-away list carries
   a bin tag as a first-class column, and pick lists are ordered by the walk, not
   by the request. The store loses hours to looking for things; this is the fix.
2. **Every quantity is three numbers: on hand, held, free.** Free is the only one
   that means anything and is styled loudest. A hold belongs to a job card and
   expires after seven days. Holds nobody collected get their own dashboard card,
   because a hold nobody came for is a shortage the store made itself.
3. **Cover mode.** A topbar toggle. When the store keeper is off, the person
   standing in has none of what he keeps in his head. Turning it on adds a hint
   line to every stock, pick and put-away row — what the item looks like, which
   wall it leans against, that bin `A1` in Riffa is not bin `A1` in Tubli. It is
   the store's tacit knowledge written down at the point it is needed rather than
   in a manual nobody opens. Default off; persists per user.

## About the design files

`AMD Dashboard Directions.dc.html` is a **design reference created in HTML** — a
prototype showing intended look, structure and behaviour. It is not production
code to copy. Recreate it in AMD-APP's own environment with its established
patterns and state management.

Direction **18a** is the section with `id="18a"`. It contains both frames
(desktop 1440 × 980 shown at .66 scale, iPhone 390 × 844). Earlier directions in
the file are prior turns kept for history — ignore them. **17a (Purchase) is the
one exception:** the shell, tokens and page/form templates are shared, so where
this document says "same as Purchase", 17a is the reference build.

## Fidelity

**High-fidelity.** Colours, type sizes, spacing, radii, copy and interaction
behaviour are final. Build both the desktop frame and the phone frame.

---

## Non-negotiables (every Store screen carries all six)

Project-wide rules from `CLAUDE.md`, all present in 18a:

1. **Back button** — `‹` in the topbar, immediately left of Quick actions, in the
   same flex wrapper. **Hidden on the dashboard root**; present on page and form
   views. Steps form → page → dashboard.
2. **Quick actions at the top** — one wine button opening a popover (desktop) or
   bottom sheet (phone). Never a row of separate buttons, never in the sidebar.
3. **Collapsible side taskbar** — 230px sidebar on desktop, collapsing to a 64px
   icon rail; below 880px it becomes a slide-in drawer behind `☰`.
4. **Weekly planner** — collapsible card; collapsed shows a count only.
   Week/Month switch plus `‹ Today ›`; selection follows the period.
5. **My tasks** — collapsible, Apple Reminders model: smart tiles
   (Today / Urgent / All / Completed), user lists, tasks linkable to a job card.
   **The store has its own task store** — never shared with Purchase or any other
   role. Default lists: Issues · Receiving · Locations · Tools.
6. **Floating chat box** — wine bubble bottom-right with unread badge; opening it
   replaces the bubble with the panel so the two never overlap.

Hard rules that affect implementation:

- Wine `#600131` is the only brand accent. Semantic red/amber/green stay distinct.
- Light theme primary, dark must work — `data-theme` on the root element.
- **The store keeper sees no money at all.** No price, no cost, no rate, no
  supplier value, no stock valuation — not on a row, not in a summary, not on a
  printed sheet. This role works in quantities and locations only. Any shared
  component must gate money by role. (Purchase sees cost but not selling price;
  Sales sees neither.)
- Dates `DD MMM YYYY`. There is no currency on these screens.
- No external libraries, no CDN, no build step in the prototype; charts are plain
  CSS/SVG.
- **Chart rule:** a bar's fill never shares a flex line with text and never
  contains a label. Label above the bar or in a fixed-width column beside it; the
  fill lives inside a full-width track.

---

## The shell

Structurally identical to Purchase (17a). Differences only:

- Brand block reads `Store` / `Al Maraya Decor`; user footer reads
  `Jassim Abdulla` 12px/650 and `Store Keeper · Tubli` 10.5px `--tx3`; the
  avatar is `JA`.
- Topbar search placeholder is `Search items, bins, jobs…` at **200px**
  (narrower than Purchase's 220 — the Cover mode button takes the difference).
- **The Cover mode button** sits immediately left of the search field: height 38,
  radius 10, gap 7, glyph `◍` at 13px, label 12.5px/650. Off =
  `1px solid --line`, `--sunk`, `--tx2`, label `Cover mode`. On =
  `1px solid --wine`, `--wine-tint`, `--wine`, label `Cover mode on`.
  On phone it is a full-width pill (min-height 42, radius 11) at the top of the
  dashboard body instead, same two states.
- Title/subtitle per view:
  | view | title | subtitle |
  |---|---|---|
  | dash | `Store` | `Thursday 07 August 2026 · 3 at the gate · 5 teams waiting · 4 stale holds` |
  | page | the page title | `Store · Thursday 07 August 2026` |
  | form | the form title | `Store · draft · nothing moves until you confirm` |

### Navigation list (both frames, same order)

| # | key | Icon | Label | Count | Tone |
|---|---|---|---|---|---|
| — | — | `▤` | Dashboard | — | — |
| 1 | `stk` | `◱` | Stock on hand | 9 | warn |
| 2 | `iss` | `⇢` | Issue to job | 5 | bad |
| 3 | `rec` | `⇠` | Receiving | 3 | wine |
| 4 | `res` | `◷` | Reservations | 4 | bad |
| 5 | `short` | `!` | Shorts | 6 | bad |
| 6 | `trf` | `⇄` | Transfers | 1 | warn |
| 7 | `ret` | `↩` | Returns to store | 3 | warn |
| 8 | `loc` | `▦` | Locations & bins | 2 | warn |
| 9 | `tool` | `⚒` | Tools on loan | 2 | bad |
| 10 | `cnt` | `✓` | Stock count | 2 | wine |
| 11 | `rem` | `⏱` | Reminders | 3 | bad |
| 12 | `doc` | `▩` | Documents | 3 | warn |

---

## View 1 — Dashboard

Desktop content: `padding: 18px 22px 26px`, `display: flex`, `gap: 18`,
`align-items: flex-start`. Left column `flex: 1`, right column **340px**.

### Left column

**0. Cover-mode banner** — renders only when Cover mode is on, above the steps.
`padding 13px 16px`, radius 14, `1px solid --wine`, `--wine-tint`, gap 12:
glyph `◍` 15px `--wine`, then title 12.5px/700 `--wine`
*Cover mode — you are standing in for Jassim* and sub 11.5px `--tx2`
*Every line now shows what it looks like and exactly where it sits, so you do not
have to know the store to run it. Turn it off when Jassim is back.*
On phone: 12px/700 title, 11px sub, no glyph.

**1. "Your day, in the order it runs"** — same construction as Purchase. Five
buttons, `flex: 1 1 226px`, count chip 26×26 (wine/white when > 0,
`--ok-bg`/`--ok` with `✓` when clear).

| # | key | Label | Sub |
|---|---|---|---|
| 1 | `rec` | Receive what arrived | 3 deliveries at the gate · check before you sign |
| 2 | `iss` | Issue against job cards | 5 teams waiting · no job card, no material |
| 3 | `res` | Reserved, not collected | holds older than 3 days freeze good stock |
| 4 | `short` | Short before the job starts | 2 jobs start Monday without full material |
| 5 | `put` | Put away and fix locations | every bin matched the system this morning |

Default selection: `iss`.

**2. The widget slot** — one card, **fixed geometry**: `flex: none`,
`min-height: 452px`, `border: 1px solid --wine-line`, radius 16, `--sh2`,
`overflow: hidden`. Content switches with the step; the card never moves or
resizes.

- **Header** — `--wine-tint`, `border-bottom: 1px solid --wine-line`,
  `padding: 15px 18px`: title 15px/650 `--wine`, sub 11.5px `--tx2`, count pill
  right.
- **Body** — `flex: 1`, scrolling, `padding: 16px 18px`. Subject header
  (15px/650, 11.5px `--tx2`, 11px `--tx3`), a `1fr 1fr` fact grid (`gap 8`,
  radius 10, tone-tinted), then **the line table** — this is the module's
  signature element and is the same component in all five states:

  Radius 12, `1px solid --line`. Header row on `--sunk`: a 22px spacer for the
  tick column, then four columns — `flex: 1 1 0%` item, `flex: 0 0 152px`
  location, `flex: 0 0 84px` right, `flex: 0 0 84px` right — all 9.5px/700
  uppercase `.08em` `--tx3`. **The column headings change per step**; the widths
  do not.

  | step | col 3 | col 4 | headings |
  |---|---|---|---|
  | `iss` | Need | Free | Item · Where it is · Need · Free |
  | `rec` | Ordered | Arrived | Item · Put it in · Ordered · Arrived |
  | `res` | Qty | Age | Held for · Where it is · Qty · Age |
  | `short` | Needed | Free | Item · Where it is · Needed · Free |
  | `put` | Actually in | Qty | Item · System says · Actually in · Qty |

  Body rows `padding: 10px 13px`, divided by `--line2`, `align-items: flex-start`:
  - **Tick box** 22×22 radius 7, `margin-top: 1px`. Unticked `1px solid --line`,
    transparent. Ticked `--ok` fill, white `✓`, and **the whole row goes
    `--ok-bg` and the item name gets `line-through` at `opacity .62`**. A row
    whose tone is `bad` (nothing free) gets a **dashed** `--bad` box and cannot
    be ticked.
  - **Item** 12.5px/650, and — **only when Cover mode is on** — a hint line
    below it: 10.5px, `line-height 1.45`, `color: --wine`, `margin-top 4px`,
    `font-style: normal`.
  - **Location tag** `flex: 0 0 152px`, inline-flex, `padding 3px 9px`, radius 7,
    11px/700. Normally `--sunk`/`--tx2`; when the row tone is `bad` it is
    `--bad-bg`/`--bad` — an empty bay reads as a problem at a glance.
  - **Column 3** 11.5px `--tx2` tabular, right.
  - **Column 4** 12.5px/700 tabular, right, tinted by row tone.
  - Then a wine banner (`margin-top 13px`, `padding 11px 13px`, radius 11,
    11.5px/600, `background: --wine`, white) carrying the judgement for that step.
- **Footer** — `padding: 13px 18px`, `border-top: 1px solid --line2`: wine
  primary (height 38, radius 10) · outlined secondary · right-aligned 11.5px
  `--tx3` note.

The five states (`stkStep` → `STKWALL`):

| key | Title | Primary action |
|---|---|---|
| `rec` | Receive what arrived | Book in 4 lines · flag 2 |
| `iss` | Issue against a job card | Issue 4 lines to JC-2026-0341 |
| `res` | Reserved, not collected | Release 2 holds to free stock |
| `short` | Short before the job starts | Raise a shortage to Purchase |
| `put` | Put away and fix locations | Re-code Store 2 · A1 |

**3. Holds nobody came for** — card radius 16, `1px solid --line`, `--sh`.
Header `padding: 14px 16px 11px`: `Holds nobody came for` 13.5px/650 +
`4 older than 3 days · stock frozen on 3 job cards` 11px `--tx3` right. Rows
`padding: 11px 16px`: job 12.5px/650, `item · location` 11px `--tx2`, then the
reason in 11px/600 `--bad`, and an age badge right (min-width 34,
`padding 4px 9px`, radius 999, `--bad-bg`/`--bad`, 11.5px/700).

### Right column (340px)

**Three stores** — `padding: 15px 16px`, radius 16. Title 12.5px/650, then three
rows `gap 9`: store name 12px/650 + `N items · N held` 10.5px `--tx3`, and a
tone-tinted status pill right (`96% bins verified` ok · `1 duplicate bin code`
warn · `Bay 3 empty` bad). Below a `border-top: 1px solid --line2`:
eyebrow `Movements this week` 11px/700 uppercase `.09em`, then four bars —
label row (11.5px/600 name left, 11.5px/650 value right) **above** a full-width
7px radius-999 `--line2` track whose fill is a child `<i>`. Issued 34 · Received
22 · Returned 9 · Transferred 6. Label never inside the fill.

**KPI stack** — one card, rows `padding: 10px 15px` divided by `--line2`:
label 12px/650 + reason 10.5px `--tx3`, value 14px/700 right, tone-tinted.

| Label | Reason | Value | Tone |
|---|---|---|---|
| Reserved, not collected | 4 holds older than 3 days · stock frozen | 4 | bad |
| Items below reorder level | 9 lines · 2 needed inside the week | 9 | warn |
| Tools out past due | Domino jointer 9 days · suction lifters | 2 | bad |
| Lines issued today | across 5 job cards · 34 lines | 34 | plain |
| Bins matching the system | rolling count · 312 lines this month | 96% | ok |

**Weekly planner** and **My tasks** — the standard collapsible cards, the store's
own task store.

---

## View 2 — Working pages (one template, twelve pages)

Identical template to Purchase — build it once and share it. Driven by
`STKPAGES[stkPage]`: title block, four-up stat row, chip toolbar, table with
fixed column flex values, last column always a status pill. On phone the table
becomes stacked rows (title + sub + meta line + pill, tap target ≥ 44px) and the
stat cards become a 2×2 grid. The right rail carries the planner, tasks, and a
`--wine-tint` rule card.

**The rule card on every Store page** (mandatory, replaces Purchase's "Purchase
never sees"): *Where it is comes before what it is. Nothing on this screen carries
a price, a cost or a supplier value — the store works in quantities.*

**The twelve pages** — full data lives in `STKPAGES` in the prototype's logic
class. Summary:

| key | Title | Primary / secondary | Columns |
|---|---|---|---|
| `stk` | Stock on hand | ＋ Issue to a job / Print a bin sheet | Item · Where it is 156 · On hand 92 (right) · Held 82 (right) · Free 96 (right) |
| `iss` | Issue to job | ＋ Issue material / Print today's issues | Request · Job card 136 · Wanted 108 · Lines 92 (right) · Status 154 |
| `rec` | Receiving | ＋ Receive a delivery / Export the day | Delivery · Supplier 152 · Order 128 · Lines 96 (right) · Status 154 |
| `res` | Reservations | ＋ Reserve for a job / Release expired holds | Held for · Where it is 150 · Qty 92 (right) · Held since 116 · Status 148 |
| `short` | Shorts | Raise a shortage / Print the Monday list | Item · For 142 · Needed 104 (right) · Free 92 (right) · Why 168 |
| `trf` | Transfers | ＋ New transfer / Print a movement note | Movement · From 132 · To 132 · Lines 88 (right) · Status 150 |
| `ret` | Returns to store | ＋ Book a return / Print offcut labels | Item · Came back from 156 · Qty 92 (right) · Condition 128 · Status 148 |
| `loc` | Locations & bins | ＋ Add a bin / Print the full map | Bin 148 · What lives here · Store 148 · Lines 84 (right) · Checked 140 |
| `tool` | Tools on loan | ＋ Book a tool out / Print the loan sheet | Tool · With 150 · Site 140 · Out since 116 · Status 140 |
| `cnt` | Stock count | ＋ Start a count / Export variances | Count · Area 150 · Lines 92 (right) · Variances 106 (right) · Status 148 |
| `rem` | Reminders | ＋ New reminder / Snooze all to Monday | Reminder · Against 146 · Who owes it 152 · Due 116 · Status 144 |
| `doc` | Documents | ＋ Upload a document / Print today's file | Document · Against 152 · Type 138 · Filed 118 · Status 144 |

Pages carrying rules worth stating outright:

- **Stock on hand** is the three-number page. `On hand` is what exists, `Held` is
  what is spoken for, `Free` is what you can actually give somebody. Where `Free`
  is zero the cell is `bad` and carries the consequence as its sub-line
  (`2 jobs waiting`), not a dash.
- **Locations & bins** is the map, and it is the artefact Cover mode depends on.
  The `What lives here` column carries the finding hint as its sub-line. A bin
  never checked shows `—` / `never` in warn. A duplicate code shows the bin
  itself in `bad`.
- **Reminders** is not automated. It is the store's own list of dated promises
  from other people — a tool due back, a supplier's revised date, a hold about to
  expire. Overdue is `bad`, today is `wine`.
- **Documents** files every movement's paper against the movement. The status
  that matters is the absence: an issue slip with no signature reads
  `Not signed` in `bad`, because it is material nobody can account for.

---

## View 3 — Create flows (one template, seven forms)

Driven by `stkForm`. Same template as Purchase: left column `flex: 1` with the
form cards, right column **300px** with the context rail; field labels 10px/700
uppercase `.05em` `--tx3`; inputs height 38 (desktop) / min-height 44 (phone).

**Tab row** — seven tabs, `display: flex; flex-wrap: wrap; gap: 9`, each
`flex: 1 1 202px`, `padding 11px 14px`, radius 12; active `1px solid --wine` +
`--wine-tint` with the label in `--wine`. On phone the row scrolls horizontally,
each tab `flex: none; min-width: 158px`.

| key | Tab label | Sub | Primary button |
|---|---|---|---|
| `iss` | Issue to a job | job card or nothing | Issue 4 lines |
| `rec` | Receive a delivery | count before you sign | Book in 4 lines · flag 2 |
| `trf` | Transfer stores | Riffa ⇄ Tubli ⇄ yard | Book the transfer |
| `res` | Reserve for a job | expires after 7 days | Hold until 14 Aug |
| `ret` | Book a return in | offcuts and over-issue | Book 3 returns in |
| `tool` | Book a tool out | on a name, with a date | Book the tool out |
| `cnt` | Start a count | blind, one rack at a time | Start the count · 48 lines |

**The gate panel** sits below the form body on every tab, above the action row:
`padding 15px 17px`, radius 16, `1px solid` the tone colour, background the tone
tint. Title 13px/700 in the tone colour, body 11.5px `--tx2`, `max-width 640px`.
**When the gate tone is `bad` the primary button is disabled** — `--line`
background, `--tx3` text, `cursor: not-allowed`. Amber and wine gates are
advisory and the button stays live.

| form | Gate tone | Gate title |
|---|---|---|
| `iss` | **bad → ok** | No job card — nothing can be issued → Cleared to issue against `<JC>` |
| `rec` | warn | Two lines do not match the order |
| `trf` | wine | The hold travels with the stock |
| `res` | warn | This hold expires 14 Aug 2026 |
| `ret` | warn | Nine sheets are coming back with nowhere to go |
| `tool` | warn | Ahmed already has two tools out, one of them overdue |
| `cnt` | wine | Blind count — you will not see the system figure |

The right rail on the Issue flow carries two cards: the wine rule card (*Material
leaves against a job card or it does not leave. A verbal request, a foreman in a
hurry and a favour all look the same in the stock figures three weeks later.*) and
**Where you will be walking** — the pick list reduced to location tags in walk
order, so the route can be read before leaving the desk.

### `iss` — Issue material to a job — **the hard gate**

**This is the module's one absolute rule and it must block, not warn.** Material
leaves the store against a job card and nothing else.

- The first card asks *Which job card is this going against?* with the sub-line
  *Nothing below can be issued until one is picked.* Three options as buttons
  (`flex: 1`, radius 11, `padding 10px 12px`): two real job cards and
  `No job card` / `general use`.
- **State A — nothing picked.** Gate is `bad`: *No job card — nothing can be
  issued* / *Material only leaves this store against a job card. Pick one above,
  or refuse the request and tell them to raise one.* Primary disabled.
- **State B — `No job card` picked.** The option itself turns `--bad`/`--bad-bg`
  and the gate stays `bad` with different copy: *General use is not a job card* /
  *Paint shop consumables still belong to a job. Ask Mahmood which job card it is
  going against — if he does not know, Operations does.* Primary still disabled.
  **There is no override.** Picking a real job card is the only way forward.
- **State C — a job card picked.** Gate turns `ok`: *Cleared to issue against
  `<JC>`* and the primary goes live.

Below the job card card: the pick list (same component as the dashboard widget,
in walk order) with a `⛶ Scan to tick` button in its header — outlined wine,
height 32, radius 9. On phone the scan button is a full-width min-height-48 wine
outline button above the list, and every tick target is ≥ 44px.

Server side: the same rule must run on save. A client-side gate is a courtesy,
not a guarantee. An issue with no job card must be rejected by the API.

### `rec` — Receive a delivery

Order · delivery note · date, then the line table with columns Item ·
`Put it in` 152 · Ordered 84 (right) · Arrived 118 (right, 12.5px/700, tinted by
tone). The put-away bin is chosen **at receiving**, not later — that is why the
column is on this form and not on a separate put-away screen. Gate: two lines
short or damaged, flagged before the driver leaves.

### `trf` — Transfer between stores

From · To · driver and time, then the lines with the held-for job shown in
11px/700 `--wine` on the right. **A hold travels with the stock** — reserved
material does not go free in transit and cannot be taken at either end.

### `res` — Reserve stock for a job

Job card · collect-by date · requester, then the lines with location tags. The
hold expires seven days out; when it does the stock returns to free and the job
card owner is told. Holds are not storage.

### `ret` — Book a return into store

Came back from (job card or `Site sweep — no job card`) · brought in by · date,
then the lines: Item + origin · `Goes into` 152 · Qty 84 (right) · Condition 96
(right, 11.5px/700, `--ok` or `--bad` for Scrap). Returns are the one movement
where **no job card is required** — material coming back is always better
recorded than not.

### `tool` — Book a tool out

Out to · going to · back by, then the tool list: name 12.5px/650 + asset id and
current holder 10.5px `--tx3`, status pill right (Available ok · Out 9 days bad ·
Due Friday warn · In repair warn). Tools go out **on a name, not a job card** —
that is the deliberate difference from material. The gate is advisory: it names
the borrower's existing overdue tool and adds it to Reminders, but does not block.

### `cnt` — Start a stock count

Area · counted by · **Blind count** shown as a locked wine field reading
`On — system figure hidden 🔒`. Then the count lines: item · location tag ·
a bare number input (`flex: 0 0 104px`, height 36, radius 9, right-aligned).
**The system figure is never rendered on this form.** The variance is computed
after submission. A count you can see the answer to is not a count.

---

## Cover mode — build this exactly

The problem it solves: when the store keeper is off sick, nobody else can run the
store, because the knowledge of where things physically are and what they look
like lives only in his head. Cover mode is that knowledge, surfaced.

- **Scope.** A single boolean on the store module, persisted per user, default
  off. It changes **no data and no layout** — it only reveals a hint line that is
  otherwise hidden.
- **Where hints appear.** On every pick, put-away, receiving and stock row that
  has one: below the item name, 10.5px, `line-height 1.45`, `color: --wine`,
  `margin-top 4px`. Nowhere else. It never appears in tables that are already
  location-led summaries (Reminders, Documents, Tools).
- **What a hint says.** The finding instruction, in the store keeper's own words.
  *Blue Gulf Timber wrapper, on edge against the west wall.* *Grey parts bin,
  third row — count them, the bag is open.* *Not in this building. Store 2 is the
  Riffa site container.* Hints are **data**, held per item-location pairing and
  editable from Locations & bins — not hard-coded strings, and not generated.
- **The banner.** While on, the dashboard shows the cover banner described above.
  Nothing else changes.
- **Do not** gate Cover mode behind a permission, an absence record or an admin
  setting. Anybody covering the store turns it on themselves, at the moment they
  need it.

---

## Interactions & behaviour

- **Sidebar** switches `stkView` and `stkPage` together; the collapsed rail does
  the same and highlights the active entry.
- **Back** steps form → page → dashboard. Hidden on the dashboard root.
- **Step buttons** set `stkStep`; the widget's header, facts, line table, column
  headings and actions all derive from it. Fixed geometry — nothing below shifts.
- **Line ticks** are keyed `${step}:${index}` so each step keeps its own tick
  state; ticking is local until the primary action commits it. A `bad`-tone line
  cannot be ticked.
- **Filter chips** set `stkPgChip` and filter the table; the stat row always
  reflects the whole page.
- **Create menu** opens the seven forms; a page's own primary button opens the
  matching form directly (`iss → iss`, `rec → rec`, `trf → trf`, `res → res`,
  `ret → ret`, `tool → tool`, `cnt → cnt`); any other page falls back to `iss`.
- **Quick actions** (both frames): Issue material to a job ⌘I · Receive a
  delivery ⌘R · Reserve stock for a job · Transfer between stores · Book a return
  in · Book a tool out · Message a department ⌘M.
- **Scanning.** Phone camera scan on the pick list and the count sheet. A
  successful scan ticks the matching line; a scan of an item not on the list
  shows what it is and where it belongs but does **not** add it to the issue.
- **Transitions** — popovers and sheets use `sheetup`
  (`translateY(16px) → 0` with opacity, `.16s–.2s ease-out`). The bell uses
  `ring`. Nothing else animates.
- **Responsive** — below 880px the sidebar becomes a drawer behind `☰`; tables
  become stacked rows; forms get the pinned bottom action bar.

## State

Per-role store. Never shared with another role.

| State | Type | Purpose |
|---|---|---|
| `stkView` | `'dash' \| 'page' \| 'form'` | which of the three views (default `dash`) |
| `stkPage` | page key | which working page (default `stk`) |
| `stkPgChip` | int | active filter chip |
| `stkForm` | form key | which create flow (default `iss`) |
| `stkStep` | step key | dashboard widget state (default `iss`) |
| `stkCover` | bool | **Cover mode** — persisted per user, default false |
| `stkTicks` | `{ [\`${step}:${i}\`]: bool }` | pick-list tick state, per step |
| `stkIssJob` | `'' \| jobCardId \| 'none'` | the issue gate — `''` and `'none'` both block |
| `stkRail` | bool | sidebar collapsed to the icon rail |
| `stkDrawer` | bool | phone drawer |
| `stkQA` / `stkQAp` | bool | quick actions popover / sheet |
| `stkWeekOpen` / `stkTasksOpen` | bool | collapsible cards (dashboard) |
| `stkSubWeekOpen` / `stkSubTasksOpen` | bool | collapsible cards (page rail) |
| `stkTasks` / `stkLists` / `stkTaskFilter` | arrays / string | store-only task store |
| `stkChatD` / `stkChatP` | bool | chat panel, desktop / phone |

**API needs:** stock by item **and location** with on-hand, reserved and free
quantities · locations/bins with a store, a description and a finding hint ·
material requests with their lines, job card and wanted-by time · goods receipts
against a purchase order with ordered-vs-arrived and a put-away bin per line ·
reservations with job card, quantity, location, held-since and expiry ·
shortfalls computed against upcoming job cards · transfers with from/to store and
the holds they carry · returns with origin, condition and destination bin · tool
assets with holder, site, out-since and due-back · stock counts with area, blind
flag, counted quantities and variances · reminders · documents with their link to
an issue, receipt, transfer, count or loan.

**Explicitly not in scope for this role's API responses:** unit cost, rate, order
value, supplier price, stock valuation. Filter them server-side — do not rely on
the client to hide them.

## Design tokens

Identical to Purchase (17a). Light theme (`:root`), dark under
`[data-theme="dark"]`.

**Brand / wine**
`--wine #600131` · `--wine2 #7c1a4a` · `--wine3 #9c3d6c` ·
`--wine-tint #f7eef3` · `--wine-line #ecd9e3`

**Surfaces / lines**
`--page #f5f6f8` · `--card #ffffff` · `--sunk #fafbfc` ·
`--line #e6e8ee` · `--line2 #eff1f5`

**Text** `--tx #101828` · `--tx2 #475467` · `--tx3 #98a2b3`

**Semantic**
`--ok #087443` / `--ok-bg #e8f6ef` · `--warn #b54708` / `--warn-bg #fef3e6` ·
`--bad #b42318` / `--bad-bg #fdecea`

**Task-list dots** `--d1 #600131` · `--d2 #8a5a2b` · `--d3 #2e5f7a` ·
`--d4 #5b6b3a`

**Dark theme** `--wine #a83c63` · `--wine-tint #2a1a22` · `--wine-line #3d2530` ·
`--page #141017` · `--card #1d1821` · `--sunk #241e28` · `--line #332b38` ·
`--line2 #2a2330` · `--tx #eee9f0` · `--tx2 #a99fb0` · `--tx3 #7d7386` ·
`--ok #4ade9b` · `--warn #f2ae5d` · `--bad #f58b83`

**Shadows** `--sh 0 1px 2px rgba(16,24,40,.04)` ·
`--sh2 0 6px 24px rgba(16,24,40,.10)`
(dark: `0 1px 2px rgba(0,0,0,.4)` / `0 8px 30px rgba(0,0,0,.5)`)

**Radius** `--r 14px`; also in use: 7 · 8 · 9 · 10 · 11 · 12 · 16 · 18 · 34
(phone bezel) · 999 (pills)

**Type** system stack
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
Scale in use: 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 15 · 16 ·
19 · 20 · 21 px. Weights 500 / 600 / 650 / 700 only.
`letter-spacing: -.01em / -.02em` on headings and numerals; `.05em–.11em` +
uppercase on eyebrow labels. Numerals in quantity columns are
`font-variant-numeric: tabular-nums`.

**Spacing** 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 15 · 16 ·
18 · 20 · 22 · 26 px.
Fixed widths: sidebar 230 (rail 64), dashboard right column 340, form/page right
column 300, phone 390, widget `min-height` 452, location tag column 152,
quantity columns 84.

**Keyframes**
`sheetup` — `from { transform: translateY(16px); opacity: 0 } to { translateY(0); opacity: 1 }`
`ring` — `0% box-shadow 0 0 0 0 rgba(180,35,24,.5) · 70% 0 0 0 8px rgba(180,35,24,0) · 100% 0`

## Assets

None. All glyphs are text characters
(`‹ ‹‹ ☰ ✕ ▾ ▤ ◱ ⇢ ⇠ ◷ ! ⇄ ↩ ▦ ⚒ ✓ ⏱ ▩ ◍ ⛶ ＋ 🔔 ✉ 🔒`). Replace with the
codebase's icon set at the same optical sizes. `◍` is Cover mode and `⛶` is
scan — pick distinct, unmistakable icons for both. Logo: `logo.jpeg` in the
project root; the prototype uses a wine `AM` square. All names, jobs, bins and
figures are **illustrative sample data** — do not ship them.

## Files

- `AMD Dashboard Directions.dc.html` — the design canvas. Direction **18a** is
  the section with `id="18a"`; it holds both frames. The logic that drives it
  lives in the component class at the bottom of the file — look for
  `stkStepDefs` and `STKWALL` (dashboard widget states), `STKPAGES` (all twelve
  working pages), `STKGATE` (the seven form gates), `stkRetLines`,
  `stkToolRows`, `stkCntLines`, `stkRecLines` (create-flow data), `stkNav` and
  `stkPages` (navigation), `stkCell` (the shared table cell renderer).
  Direction **17a** in the same file is Purchase — the shell, page template and
  form template are shared; build them once.
- `support.js` — the prototype runtime. Needed only to open the HTML file
  locally. **Not** part of the production build.
- `CLAUDE.md` — the project standards, at the repository root. Reproduced above
  under Non-negotiables; if the two ever disagree, `CLAUDE.md` wins.

## Acceptance criteria

- [ ] All six non-negotiables present on every Store screen, desktop and phone.
- [ ] Back button hidden on the dashboard root, present elsewhere, stepping
      form → page → dashboard.
- [ ] Sidebar collapses to the 64px rail; the rail navigates and highlights the
      active entry.
- [ ] All twelve working pages render from one template with the exact columns,
      stats, chips and status pills specified.
- [ ] All seven create flows render from one template; each ends with its gate
      panel, and a `bad` gate disables the primary.
- [ ] **Material cannot be issued without a job card** — client and server. The
      `No job card` option blocks with no override.
- [ ] Every stock, pick and put-away row leads with a location tag, and pick
      lists are ordered by the walk.
- [ ] Every quantity shows on hand, held and free; `Free` zero renders `bad` with
      its consequence, not a dash.
- [ ] Cover mode toggles from the topbar, persists per user, reveals the hint
      line on every row that has one, and changes nothing else.
- [ ] A blind count never renders the system figure before submission.
- [ ] **No price, cost, rate, supplier value or stock valuation appears anywhere
      in the Store module**, and none is sent by the API.
- [ ] Dates render `DD MMM YYYY`.
- [ ] Dark theme works via `data-theme`.
- [ ] Side by side with the prototype at the same width, the two are difficult
      to tell apart.
