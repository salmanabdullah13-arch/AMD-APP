# 22b — fold heading sub-lines into `?` hover badges

Production dashboard. Five headings lose their sub-line; each gains a `?`
badge that reveals the same text on hover. Buys back ~120px of vertical space
on the dashboard.

All edits are in **`production-ui.js`**. No CSS file changes are strictly
required (the badge is inline-styled below), but adding the class in step 6 is
cleaner if you prefer.

## 1. Add the badge helper

Put this next to `esc()` near the top of the `PrdUI` IIFE (after the `bd()` /
`ddmmm()` helpers):

```js
  /* 22b — a heading's explanatory sub-line, folded into a hover badge.
     tone: 'wine' on wine-tinted card headers, 'neutral' on plain ones,
     'bad' where the sub-line states a refusal. Text goes in title=, so it
     must be plain — strip any markup before calling. */
  function qBadge(text, tone) {
    if (!text) return '';
    var ring = tone === 'wine' ? 'var(--wine-line)' : tone === 'bad' ? 'var(--bad)' : 'var(--biz-text-muted)';
    var ink  = tone === 'wine' ? 'var(--wine)'      : tone === 'bad' ? 'var(--bad)' : 'var(--biz-text-2)';
    return '<span class="prd-q" title="' + esc(text) + '" style="display:inline-flex;' +
      'align-items:center;justify-content:center;flex:none;width:17px;height:17px;' +
      'border-radius:999px;border:1px solid ' + ring + ';background:var(--biz-card-bg);' +
      'color:' + ink + ';font-size:10.5px;font-weight:700;cursor:help">?</span>';
  }
```

Check the two var names against your token sheet — I used `--biz-text-muted` /
`--biz-text-2` for the neutral pair and `--biz-card-bg` for the fill. If those
aren't the live names, substitute the ones `production.css` actually uses for
muted text, secondary text and card background.

## 2. Page subtitle → badge on the "Production" heading

The topbar subtitle (`prdRefreshSubtitle`, the
`Wednesday, 26 August 2026 · 1 thing asked of you · …` line) stops being its
own line and becomes the badge on the page title.

- Keep `prdRefreshSubtitle()` computing the string — it is still the source.
- Where the title and subtitle are emitted, replace the two stacked elements
  with title + badge on one flex row:

```js
'<div style="display:flex;align-items:center;gap:7px">' +
  '<span class="prd-page-t">Production</span>' +
  qBadge(subtitleText, 'neutral') +
'</div>'
```

Delete the element that rendered `subtitleText` as a line of its own.

## 3. `askedHTML()` — "Asked of you today"

Find:

```js
'<div class="prd-asked-t">Asked of you today</div>' +
'<div class="prd-sub prd-sub-lg">Other people\'s deadlines. These come before the board, because somebody is waiting on the other end.</div>' +
```

Replace with:

```js
'<div style="display:flex;align-items:center;gap:7px">' +
  '<span class="prd-asked-t">Asked of you today</span>' +
  qBadge("Other people's deadlines. These come before the board, because somebody is waiting on the other end.", 'wine') +
'</div>' +
```

## 4. `boardHTML()` — "The week board"

Find:

```js
'<div class="prd-t">The week board</div>' +
'<div class="prd-sub prd-sub-lg">Four lanes, one clock. <b>Paint and install pull their dates from joinery</b> — move a joinery slot and the ones after it move with it. Green Friday cells are <b>overtime</b>, booked against the target they recover.</div>' +
```

Replace with:

```js
'<div style="display:flex;align-items:center;gap:7px">' +
  '<span class="prd-t">The week board</span>' +
  qBadge('Four lanes, one clock. Paint and install pull their dates from joinery — move a joinery slot and the ones after it move with it. Green Friday cells are overtime, booked against the target they recover.', 'neutral') +
'</div>' +
```

Note the `<b>` tags are dropped — a `title` attribute is plain text.

## 5. `teamsHTML()` — "Teams today"

Find the header line and the sub-line under it:

```js
'<div class="prd-sub">Crews and where they physically are. Who stands in each crew is the labour dashboard\'s business.</div>'
```

Put the badge on the "Teams today" heading with tone `'neutral'`, using that
same sentence, and delete the sub-line element. Keep the `Wed 26 Aug` date on
the right of the header row — it is data, not explanation.

## 6. Optional — hoist the badge into CSS

If you'd rather not carry inline styles, add to `production.css`:

```css
#prd-module-wrap .prd-q {
  display: inline-flex; align-items: center; justify-content: center;
  flex: none; width: 17px; height: 17px; border-radius: 999px;
  background: var(--biz-card-bg); font-size: 10.5px; font-weight: 700;
  cursor: help; border: 1px solid var(--biz-text-muted);
  color: var(--biz-text-2);
}
#prd-module-wrap .prd-q.q-wine { border-color: var(--wine-line); color: var(--wine); }
#prd-module-wrap .prd-q.q-bad  { border-color: var(--bad); color: var(--bad); }
```

…and have `qBadge()` emit `class="prd-q q-wine"` etc. instead of the inline
`style`.

## DO NOT do this one

The **"Waiting for a lane"** strip keeps its sub-line as text:

> A lane will not take a job with no material or a pending revision

That sentence explains why three job cards are sitting there refused. Hiding
the reason behind a hover at the exact moment somebody asks "why is this
stuck" costs more than the line saves. Same call we made on the gate
sub-lines: an explanation that is *load-bearing at the decision* stays
visible. Only descriptions of what a card *is* become badges.

## Phone

`title` does not open on a tap, so on the phone build these must not be hover
badges. Use the tappable-chip pattern instead — a `? What this page is for`
chip that expands the text inline on tap. Do not ship hover-only badges to
the phone view.

## Check when done

1. Hover each of the four badges — text appears, and it is the same sentence
   that used to be printed.
2. The week board's first row is visible without scrolling at 1440×900.
3. "Waiting for a lane" still shows its red sentence as text.
4. Nothing else on the dashboard moved: the KPI rail, planner and paperwork
   card are untouched.
