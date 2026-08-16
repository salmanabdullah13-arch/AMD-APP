# Handoff: Purchase module (direction 17a)

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

The Purchase Officer's whole module in AMD-APP: one app, three view modes off a
single shell. Purchase runs the request-to-delivery cycle — a department raises a
request off a verified BOM, Purchase sources it (rate contract or RFQ), raises
the PO, Operations releases it above BD 1,000, the store books the goods in, and
mismatches stay open until claimed.

Three views share the shell:

- **Dashboard** (`purView: 'dash'`) — the five-step day, a fixed widget slot, open
  POs, spend, KPIs, planner, tasks.
- **Working page** (`purView: 'page'`) — ten list pages, one template, driven by
  `purPage`.
- **Create flow** (`purView: 'form'`) — four creation forms, one template, driven
  by `purForm`.

The sidebar drives all three. The phone frame follows the same state through its
`☰` drawer, so the two are never out of step.

## About the design files

`AMD Dashboard Directions.dc.html` is a **design reference created in HTML** — a
prototype showing intended look, structure and behaviour. It is not production
code to copy. Recreate it in AMD-APP's own environment with its established
patterns and state management.

Direction **17a** is the section with `id="17a"`. It contains both frames
(desktop 1440 × 980 shown at .66 scale, iPhone 390 × 844). Earlier directions in
the file are prior turns kept for history — ignore them.

## Fidelity

**High-fidelity.** Colours, type sizes, spacing, radii, copy and interaction
behaviour are final. Build both the desktop frame and the phone frame.

---

## Non-negotiables (every Purchase screen carries all six)

Project-wide rules from `CLAUDE.md`, all present in 17a:

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
   **Purchase has its own task store** — never shared with another role.
6. **Floating chat box** — wine bubble bottom-right with unread badge; opening it
   replaces the bubble with the panel so the two never overlap.

Hard rules that affect implementation:

- Wine `#600131` is the only brand accent. Semantic red/amber/green stay distinct.
- Light theme primary, dark must work — `data-theme` on the root element.
- **Purchase sees cost and supplier. Purchase never sees the client selling price
  or the job margin.** Any shared component must gate money by role. (Sales sees
  neither cost nor supplier — a stricter rule, same mechanism.)
- Currency `BD 1,350.000`, always 3 decimals. Dates `DD MMM YYYY`.
- No external libraries, no CDN, no build step in the prototype; charts are plain
  CSS/SVG.
- **Chart rule:** a bar's fill never shares a flex line with text and never
  contains a label. Label above the bar or in a fixed-width column beside it; the
  fill lives inside a full-width track.

---

## The shell

### Desktop (1440 × 980)

`flex` row.

**Sidebar** — 230px, `background: --card`, `border-right: 1px solid --line`.

- Brand block, `padding: 16px 14px 14px`, gap 10: wine 32×32 radius 9 square
  reading `AM` (12px/700 white) · name block (`Purchase` 13.5px/650,
  `Al Maraya Decor` 11px `--tx3`) · collapse `‹‹` button 26×26 radius 8,
  `1px solid --line`.
- Nav list, `padding: 2px 10px`, `gap: 2`, scrolling. Items: `padding 9px 10px`,
  radius 9, gap 10, icon column 17px centred 14px glyph, label 13px, count badge
  right. Active = `--wine-tint` background, `--wine` text, weight 650.
  Badge: min-width 20, height 19, `padding 0 6px`, radius 999, 10.5px/700, tinted
  `--bad-bg/--bad`, `--warn-bg/--warn` or `--wine`/white by tone.
- `＋ Create…` button below the list, opening the create menu.
- User footer, `border-top: 1px solid --line2`, `padding: 12px 14px`:
  `Ali Mansoor` 12px/650, `Purchase Officer` 10.5px `--tx3`.

**Collapsed rail** — 64px, same background and border, `padding: 14px 0`.
Expand button 36×36 radius 10 on `--sunk`, then one 44×40 radius 10 button per
nav entry, 15px glyph, `title` = the label. **The active entry is
`--wine-tint`/`--wine`** — on the dashboard root that is Dashboard, on a page it
is that page. A 7×7 tone-tinted dot sits `top: 5px; right: 6px` where the entry
has a count. Every rail button navigates.

**Main column** — `flex: 1`, `background: --page`.

- **Topbar** height 62, `background: --card`, `border-bottom: 1px solid --line`,
  `padding: 0 22px`, gap 14, `z-index: 6`:
  `[‹ 38×38 radius 10, 1px solid --line — hidden on dashboard root]`
  `[＋ Quick actions — wine, height 38, radius 10, 13.5px/600, ▾]`
  then the title block (16px/650 title, 11.5px `--tx3` subtitle), then a 220px
  search field (height 38, radius 10, `--sunk`, `1px solid --line`), 🔔 38×38
  with the `ring` pulse, avatar `AM` 38×38 radius 999 on `--wine-tint`.
  Title/subtitle per view:
  | view | title | subtitle |
  |---|---|---|
  | dash | `Purchase` | `Thursday 07 August 2026 · 11 open POs · 2 supplier deliveries late · 1 GRN short` |
  | page | the page title | `Purchase · Thursday 07 August 2026` |
  | form | the form title | `Purchase · draft · nothing is sent until you say so` |
- **Content** — `flex: 1`, scrolling, per view (below).
- **Floating chat** — bubble 58×58 wine, `bottom: 24, right: 26`, `✉`, badge
  22×22 `--bad`. Open state: 344×430 panel at the same anchor, `sheetup` in.

### Phone (390 × 844)

Notch pill 112×30 at top, status row, then the topbar row
`[☰ 38×40] [‹ 34×40 — hidden on dashboard root] [＋ Quick actions, flex:1, 40 high] [🔔 38×40]`,
all radius 11. Title block below it (19px/650 + 11.5px `--tx3`). Body scrolls,
`padding: 8px 14px 96px`. Quick actions renders as a bottom sheet; the drawer
slides the full 230px sidebar in from the left over a scrim. **All tap targets
≥ 44px.** Create forms get a fixed action bar pinned to the bottom
(`padding: 12px 14px 20px`, `background: --card`, `border-top: 1px solid --line`).

### Navigation list (both frames, same order)

| # | key | Icon | Label | Count | Tone |
|---|---|---|---|---|---|
| — | — | `▤` | Dashboard | — | — |
| 1 | `pr` | `◇` | Purchase requests | 4 | bad |
| 2 | `rfq` | `⇄` | RFQs & quotes | 3 | warn |
| 3 | `po` | `▤` | Purchase orders | 3 | wine |
| 4 | `del` | `⇢` | Deliveries due | 2 | bad |
| 5 | `grn` | `✓` | GRN & returns | 1 | warn |
| 6 | `item` | `◱` | Item master | 7 | warn |
| 7 | `sup` | `◫` | Suppliers | — | — |
| 8 | `ctr` | `▦` | Rate contracts | 1 | warn |
| 9 | `rem` | `⏱` | Reminders | 2 | bad |
| 10 | `doc` | `▩` | Documents | 4 | warn |

---

## View 1 — Dashboard

Desktop content: `padding: 18px 22px 26px`, `display: flex`, `gap: 18`,
`align-items: flex-start`. Left column `flex: 1`, right column **340px**.

### Left column

**1. "Your day, in the order it runs"**
Eyebrow 11px/700 uppercase `.11em` `--tx3`. Five buttons in a wrapping flex row,
`gap 8`, each `flex: 1 1 226px`; phone stacks them. Each: count chip 26×26
radius 999 (wine/white when > 0, `--ok-bg`/`--ok` with `✓` when clear), title
12.5px/650, sub 10.5px `--tx3`. Selected = `1px solid --wine` + `--wine-tint`.

| # | key | Label | Sub |
|---|---|---|---|
| 1 | `pr` | Purchase requests | verified BOMs waiting to be ordered |
| 2 | `cmp` | Compare supplier quotes | RFQs back · one becomes the PO |
| 3 | `rel` | POs with Operations | awaiting release · nothing ordered yet |
| 4 | `late` | Chase late deliveries | past the promised date · the floor waits |
| 5 | `grn` | GRN mismatches | the store received short or wrong |

Default selection: `cmp`.

**2. The widget slot** — one card, **fixed geometry**: `flex: none`,
`min-height: 452px`, `display: flex; flex-direction: column`,
`border: 1px solid --wine-line`, radius 16, `box-shadow: --sh2`,
`overflow: hidden`. Content switches with the step; the card never moves or
resizes, so nothing below it shifts.

- **Header** — `--wine-tint`, `border-bottom: 1px solid --wine-line`,
  `padding: 15px 18px`: title 15px/650 `--wine`, sub 11.5px `--tx2`, count pill
  (wine, white, 11.5px/700, radius 999) on the right.
- **Body** — `flex: 1`, scrolling, `padding: 16px 18px`. Job header (15px/650
  name, 11.5px `--tx2` id line, 11px `--tx3` source line), then a
  `1fr 1fr` grid of fact rows (`gap 8`, radius 10, tinted by tone: label
  11.5px/600 `--tx2` left, value right), then per state one of:
  - **quote comparison** (`cmp`) — three supplier rows, each a button: mark
    18×18 radius 999, supplier 13px/650 + on-time record 10.5px `--tx3`, a note
    line, price column 112px right (14px/700 + terms), lead column 76px right.
    The recommended one carries `✓`.
  - **line table** (`pr`, `grn`) — radius 12, `1px solid --line`; header row on
    `--sunk` (9.5px/700 uppercase `.08em`), then rows `padding 9px 13px`
    divided by `--line2`: item 12.5px/600 + note, qty column 82px right, value
    column 106px right.
  - a note paragraph and/or a tinted banner.
- **Footer** — `flex: none`, `padding: 13px 18px`,
  `border-top: 1px solid --line2`: primary wine button (height 38, radius 10) ·
  secondary outlined button · "N more after this" 11.5px `--tx3` right.

The five states (`purStep` → `PURWALL`):

| key | Title | Primary action |
|---|---|---|
| `pr` | Purchase requests | Order against the rate contract |
| `cmp` | Compare supplier quotes | Raise the PO from this quote → |
| `rel` | POs with Operations | Chase the release |
| `late` | Chase late deliveries | Ask for a revised date |
| `grn` | GRN mismatches | Claim the balance from Nassar |

**3. Open purchase orders** — card radius 16, `1px solid --line`, `--sh`.
Header `padding: 14px 16px 11px`, `border-bottom: 1px solid --line2`:
`Open purchase orders` 13.5px/650 + `11 open · BD 12,940.000 committed` 11px
`--tx3` right. Rows `padding: 11px 16px`, divided: item 12.5px/650 + `id ·
supplier · job` 11px `--tx3`, value column 112px right tabular, status pill.

### Right column (340px)

**Committed this month** — `padding: 15px 16px`, radius 16. Header row: label
12.5px/650 + `BD 18,420` 22px/650 `-.02em`. Sub 11px `--tx3`
`across 23 purchase orders · 11 still open`. Then, above a
`border-top: 1px solid --line2`, five category bars: label row (11.5px/600 name
left, 11.5px/650 value right) **above** a full-width 7px radius-999 `--line2`
track whose fill is a child `<i>`. Label never inside the fill — see the chart
rule.

**KPI stack** — one card, rows `padding: 10px 15px` divided by `--line2`:
label 12px/650 + reason 10.5px `--tx3` left, value 14px/700 right, tone-tinted.

**Weekly planner** and **My tasks** — the standard collapsible cards, Purchase's
own task store.

---

## View 2 — Working pages (one template, ten pages)

Every page is the same template driven by `PURPAGES[purPage]`. Build it once.

**Structure** (desktop, `padding: 18px 22px 26px`):

1. **Title block** — page title 16px/650 in the topbar; the page's own `sub`
   sentence renders at the top of the content, 12.5px `--tx2`, max ~840px.
2. **Stat row** — four cards in a `1fr 1fr 1fr 1fr` grid, `gap 12`, radius 14,
   `1px solid --line`, `--sh`, `padding 13px 15px`: label 11px/650 `--tx3`,
   value 21px/650 `-.02em` tinted by tone.
3. **Toolbar** — filter chips left (radius 999, `padding 6px 12px`, 11.5px/650;
   active = `--wine-tint`/`--wine`/`1px solid --wine`, idle = `1px solid --line`
   transparent `--tx3`), then the secondary outlined button and the wine primary
   button right.
4. **Table** — radius 16, `1px solid --line`, `--sh`, `overflow: hidden`.
   Header row on `--sunk`, `border-bottom: 1px solid --line2`, cells 9.5px/700
   uppercase `.08em` `--tx3`. Body rows `padding: 12px 16px`, `gap 12`, divided
   by `--line2`. Column flex values are given per page below and are **fixed** —
   the first column is `1 1 0%`, the rest are pinned pixel widths.
   Cell rendering: first column 12.5px/650 `--tx` plus a 11px `--tx3` sub-line;
   middle columns 12.5px/600 plus optional sub; right-aligned columns are
   `font-variant-numeric: tabular-nums`; **the last column is always a status
   pill** (`padding 4px 10px`, radius 999, 10.5px/700, tone-tinted).

On phone the table becomes stacked rows: title + meta line + status pill, tap
target ≥ 44px. Stat cards become a 2×2 grid.

**The ten pages** — full data lives in `PURPAGES` in the prototype's logic class.
Summary:

| key | Title | Primary / secondary | Columns |
|---|---|---|---|
| `pr` | Purchase requests | ＋ New request / Export | Request · Job card 128 · Needed by 104 · BOM allowance 118 (right) · Status 150 |
| `rfq` | RFQs & quotes | ＋ New RFQ / Chase all open | RFQ · Quotes in 96 · Best price 122 (right) · Best lead 96 · Status 150 |
| `po` | Purchase orders | ＋ Raise a PO / Export | Purchase order · Supplier 150 · Job card 120 · Value 118 (right) · Status 148 |
| `del` | Deliveries due | Record a delivery / Print the week | Item · Supplier 146 · PO 126 · Promised 106 · Status 150 |
| `grn` | GRN & returns | ＋ New GRN / Open a return | Goods receipt · PO 126 · Received 128 · Value 118 (right) · Result 146 |
| `item` | Item master | ＋ New item / Export | Item · Code 110 · Unit 84 · Last rate 118 (right) · Stock 150 |
| `sup` | Suppliers | ＋ Add supplier / Export | Supplier · Category 146 · Open POs 92 · Spend this year 132 (right) · On time 128 |
| `ctr` | Rate contracts | ＋ New contract / Renew expiring | Contract · Supplier 150 · Items covered 150 · Rate held to 120 · Status 130 |
| `rem` | Reminders | ＋ New reminder / Snooze the week | Reminder · Against 150 · Due 118 · Raised by 128 · Status 140 |
| `doc` | Documents | Upload a document / Export the month | Document · Type 132 · Filed against 148 · Date 112 · Status 146 |

Two of these carry rules worth stating outright:

- **Reminders** is not automated. It is the officer's own list of dated chases
  against a PO, GRN, contract or request — a supplier gone quiet, a claim nobody
  answered, a contract about to lapse. Overdue rows are `bad`, today is `wine`.
- **Documents** files every paper against the order it belongs to. The status
  that matters is the absence: a PO received in full with no supplier invoice
  reads `Not received` in `warn`, because it is a payment Accounts cannot make.
  Expiring certificates and trade licences read `bad` with the day count.

---

## View 3 — Create flows (one template, four forms)

Driven by `purForm`. Desktop layout: `display: flex`, `gap: 14`; left column
`flex: 1` holding the form cards (radius 16, `1px solid --line`, `--sh`,
`padding 16px 18px`, `gap 12` between cards), right column **318px** holding the
context rail. Field labels are 10px/700 uppercase `.05em` `--tx3` with a 5px
gap; inputs are height 38 (desktop) / min-height 44 (phone), radius 9/10,
`1px solid --line`, 12.5px/13px.

Action row at the bottom of the left column: wine primary (height 40, radius 11,
13px/650) · `Save as draft` outlined · spacer · `Discard` outlined `--tx3`.

The right rail always ends with the **"Purchase never sees"** card
(`1px solid --wine-line`, `--wine-tint`, radius 16): *The client selling price or
the job margin. Cost, allowance and supplier — that is the whole picture on this
side.* **This card is mandatory on every create flow.**

### `pr` — New purchase request

Lines come off a verified BOM with a checkbox each; unchecked rows sit on
`--sunk` with `--tx3` text. Right rail shows **Requested value** (24px/650) and a
route pill: `Above BD 1,000 — three quotes required` (warn) or
`Under BD 1,000 — order direct` (ok), plus the rule: *The BOM allowance is the
ceiling. Request less and the balance stays available — request more and it needs
a variation before Purchase can act.* Priority is a two-option segmented control
(`Normal` / `Urgent — floor is waiting`).

### `rfq` — New request for quotation

Supplier picker, four selectable cards (checkbox, name, category, on-time
record, terms, note). Primary reads `Send the RFQ to N suppliers`. Rule line:
`Three or more — the rule is met` (ok) or
`Fewer than three — Operations will send it back` (bad). Right rail lists **what
the supplier sees** — specification and quantity only; our allowance, the job
card and the client never leave the building.

### `po` — Raise a purchase order

Line table from the chosen quote with a total against the BOM allowance. Over the
allowance, a variance box appears and **a written reason is required** before the
PO can be sent. Right rail shows the signing route in order: Purchase raises →
Operations releases (over BD 1,000) → Owner counter-signs (over BD 5,000) →
supplier. Under BD 1,000 the PO auto-releases.

### `item` — New inventory item

**Purchase owns the item code.** Once it exists, every BOM, quote and store count
uses this one spelling of it. Fields: Description (a real text input) · Category ·
Item code (assigned, locked, shown `WVN-0021 · assigned 🔒`) · **Unit of measure**
as a chip row, labelled *this cannot change once a BOM uses it* · default
supplier · standard rate · reorder level · a Stocked / Buy-to-order toggle ·
specification textarea.

Under the unit row sits a `Try a description:` chip row with three presets
(`exact duplicate`, `close variant`, `new to the master`) — these exist so the
duplicate gate can be demonstrated without typing. **Keep them in the prototype
build; drop them in production.**

---

## The duplicate gate (item creation) — build this exactly

A duplicate item code is a real failure, not a tidiness problem: two codes for
one item split the stock count, split the purchase history, and put two different
"last rates" in front of the Estimator. The gate must **block**, not warn.

### Matching

The description is normalised and matched against the item master on every
keystroke:

1. Lowercase; replace every run of non-alphanumeric characters (keeping `.`) with
   a space; split on spaces; drop empties.
2. Map known abbreviations to their canonical token — `vnr`/`ven`/`veneers` →
   `veneer`, `plywood`/`plw` → `ply`, `book`/`matched`/`bookmatched` →
   `bookmatch`, `sht`/`sheets` → `sheet`, `ltr`/`litre`/`litres` → `l`, and so on.
   **Extend this map from the real master's actual spellings** — it is the part
   that does the work.
3. Split the tokens into numeric (`1.2`, `18`, `280`) and word tokens.
4. Base score = Sørensen–Dice over the token sets: `2 × shared / (|a| + |b|)`.
5. Adjust:
   - identical word tokens **and** identical numeric tokens → score `1.0`
   - identical word tokens, different figures → score is floored at `0.70`
     (same item, different size — a variant, not automatically a duplicate)
   - different words, identical figures → `+0.10`
6. Keep matches scoring ≥ `0.34`, sort descending, show the top 3.

### The three states

| Top score | State | Behaviour |
|---|---|---|
| ≥ 0.92 | **exact** | `--bad-bg` / `--bad` card, *This item already exists*. Create is **disabled** and reads `Cannot create — duplicate`, with `Blocked — <CODE> is this item` beside it. **No override exists.** The officer must change the description or open the existing code. |
| ≥ 0.62 | **near** | `--warn-bg` / `--warn` card, *Close to an existing code*. Create stays disabled until the officer taps `Not a duplicate — this is a different item` **and** picks a difference (Different thickness / cut / grade / size). The reason is stored on the code and shown to anyone who searches either spelling. |
| ≥ 0.34 | **weak** | `--sunk` / `--tx2` card, *One loose match*. Create is enabled; the match is shown for information. |
| < 0.34 | **clear** | `--ok-bg` / `--ok` card, *No match — safe to create*. Create is enabled. |

Editing the description **resets the override and the stated difference** — a
reason given for one spelling must not carry to another.

### The gate card

Sits at the top of the right rail on desktop, and inline below the fields on
phone. Title 12.5px/700 in the state colour, sub 11.5px `--tx2`. Then one row per
match: a `--card` panel, radius 11, `1px solid --line`, `padding 9px 11px` —
item name 12px/650, a match-percentage pill on the right (tinted red ≥ 92%,
amber ≥ 62%, neutral below), `code · unit · used on N BOMs` 10.5px `--tx3`, and a
`Use this code` button (outlined wine, ≥ 28px desktop / 40px phone) that
**navigates to that code in the item master**. Offering the existing code is the
point — a block with no way forward gets worked around.

Server side: the same normalisation and threshold must run on save. A client-side
gate is a courtesy, not a guarantee.

---

## Interactions & behaviour

- **Sidebar** switches `purView` and `purPage` together; the collapsed rail does
  the same and highlights the active entry.
- **Back** steps form → page → dashboard. Hidden on the dashboard root.
- **Step buttons** set `purStep`; the widget's header, facts, body and actions
  all derive from it. Fixed geometry — nothing below shifts.
- **Filter chips** set `purPgChip` and filter the table; the stat row always
  reflects the whole page.
- **Create menu** opens the four forms; a page's own primary button opens the
  matching form directly (`pr → pr`, `rfq → rfq`, `po → po`, `item → item`).
- **Form enforcement** — over-allowance needs a written reason; fewer than three
  RFQ suppliers is rejected by Operations; an exact item duplicate cannot be
  created at all.
- **Quick actions** (both frames): Raise a purchase order ⌘P · Send an RFQ ⌘R ·
  Record a delivery · Log a supplier chase · Add a supplier · Renew a rate
  contract · Message a department ⌘M.
- **Transitions** — popovers and sheets use `sheetup`
  (`translateY(16px) → 0` with opacity, `.16s–.2s ease-out`). The bell uses
  `ring`. Nothing else animates.
- **Responsive** — below 880px the sidebar becomes a drawer behind `☰`; tables
  become stacked rows; forms get the pinned bottom action bar.

## State

Per-role Purchase store. Never shared with another role.

| State | Type | Purpose |
|---|---|---|
| `purView` | `'dash' \| 'page' \| 'form'` | which of the three views (default `dash`) |
| `purPage` | page key | which working page (default `pr`) |
| `purPgChip` | int | active filter chip |
| `purForm` | `'pr' \| 'rfq' \| 'po' \| 'item'` | which create flow |
| `purStep` | step key | dashboard widget state (default `cmp`) |
| `purRail` | bool | sidebar collapsed to the icon rail |
| `purDrawer` | bool | phone drawer |
| `purQA` / `purQAp` | bool | quick actions popover / sheet |
| `purReqSel` | `{ [lineKey]: bool }` | request line selection |
| `purPriority` | string | request priority |
| `purRfqSel` | `{ [supplierKey]: bool }` | RFQ supplier selection |
| `purItemName` | string | item description — drives the duplicate gate |
| `purItemUnit` | string | unit of measure |
| `purItemStock` | bool | stocked vs buy-to-order |
| `purItemOverride` | bool | "not a duplicate" declared |
| `purItemDiff` | string | the stated difference (required with the override) |
| `purWeekOpen` / `purTasksOpen` | bool | collapsible cards |
| `purWeekMode` / `purWeekSel` | `'week' \| 'month'`, date | planner period + selection |
| `purTasks` / `purLists` / `purTaskFilter` | arrays / string | Purchase-only task store |
| `purChatD` / `purChatP` | bool | chat panel, desktop / phone |

**API needs:** purchase requests with their verified BOM lines and allowance ·
RFQs with quotes per supplier (price, lead time, terms, on-time record) ·
purchase orders with release state and promised date · deliveries with promised
vs actual · goods receipts with received-vs-ordered quantities and claim state ·
the item master (code, description, unit, category, last rate, stock, reorder
level, default supplier, BOM usage count) · suppliers with on-time percentage and
spend · rate contracts with cover and expiry · reminders · documents with their
link to a PO, GRN or supplier.

## Design tokens

Light theme (`:root`), dark under `[data-theme="dark"]`.

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

**Dark theme** `--wine #a83c63` · `--wine-tint #2a1a22` · `--wine-line #3d2530` ·
`--page #141017` · `--card #1d1821` · `--sunk #241e28` · `--line #332b38` ·
`--line2 #2a2330` · `--tx #eee9f0` · `--tx2 #a99fb0` · `--tx3 #7d7386` ·
`--ok #4ade9b` · `--warn #f2ae5d` · `--bad #f58b83`

**Shadows** `--sh 0 1px 2px rgba(16,24,40,.04)` ·
`--sh2 0 6px 24px rgba(16,24,40,.10)`
(dark: `0 1px 2px rgba(0,0,0,.4)` / `0 8px 30px rgba(0,0,0,.5)`)

**Radius** `--r 14px`; also in use: 5 · 6 · 8 · 9 · 10 · 11 · 12 · 16 · 18 · 34
(phone bezel) · 999 (pills)

**Type** system stack
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
Scale in use: 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 15 · 16 ·
19 · 21 · 22 · 24 px. Weights 500 / 600 / 650 / 700 only.
`letter-spacing: -.01em / -.02em` on headings and numerals; `.05em–.11em` +
uppercase on eyebrow labels. Numerals in value columns are
`font-variant-numeric: tabular-nums`.

**Spacing** 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 15 · 16 ·
18 · 20 · 22 · 26 px.
Fixed widths: sidebar 230 (rail 64), dashboard right column 340, form right
column 318, phone 390, widget `min-height` 452.

**Keyframes**
`sheetup` — `from { transform: translateY(16px); opacity: 0 } to { translateY(0); opacity: 1 }`
`ring` — `0% box-shadow 0 0 0 0 rgba(180,35,24,.5) · 70% 0 0 0 8px rgba(180,35,24,0) · 100% 0`

## Assets

None. All glyphs are text characters
(`‹ ‹‹ ☰ ✕ ▾ ▤ ◇ ⇄ ⇢ ✓ ◱ ◫ ▦ ⏱ ▩ ＋ 🔔 ✉ 🔒`). Replace with the codebase's icon
set at the same optical sizes. Logo: `logo.jpeg` in the project root; the
prototype uses a wine `AM` square. All names, suppliers, jobs and figures are
**illustrative sample data** — do not ship them.

## Files

- `AMD Dashboard Directions.dc.html` — the design canvas. Direction **17a** is
  the section with `id="17a"`; it holds both frames. The logic that drives it
  lives in the component class at the bottom of the file — look for
  `purStepDefs` and `PURWALL` (dashboard widget states), `PURPAGES` (all ten
  working pages), `ITEMMASTER` / `inorm` / `iScored` (the duplicate gate),
  `PRLINES`, `PSUPS`, `POLINES` (create-flow data), `purNav` and `purPages`
  (navigation).
- `support.js` — the prototype runtime. Needed only to open the HTML file
  locally. **Not** part of the production build.
- `CLAUDE.md` — the project standards, at the repository root. Reproduced above
  under Non-negotiables; if the two ever disagree, `CLAUDE.md` wins.

## Acceptance criteria

- [ ] All six non-negotiables present on every Purchase screen, desktop and phone.
- [ ] Back button hidden on the dashboard root, present elsewhere, stepping
      form → page → dashboard.
- [ ] Sidebar collapses to the 64px rail; the rail navigates and highlights the
      active entry.
- [ ] All ten working pages render from one template with the exact columns,
      stats, chips and status pills specified.
- [ ] All four create flows render from one template, each ending with the
      "Purchase never sees" card.
- [ ] An exact item duplicate **cannot be created** — client and server.
- [ ] A near-match cannot be created without a stated difference, and that
      difference is persisted on the code.
- [ ] Every duplicate match offers `Use this code` and navigates to it.
- [ ] No selling price and no margin appear anywhere in Purchase.
- [ ] Currency renders `BD 1,350.000`; dates render `DD MMM YYYY`.
- [ ] Dark theme works via `data-theme`.
- [ ] Side by side with the prototype at the same width, the two are difficult
      to tell apart.
