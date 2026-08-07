# AMD-APP — Design brief for Claude (design iterations)

Paste this whole file as your prompt. Everything below is real, current state.

---

## What the product is

**AMD-APP** is the internal operations app for **Al Maraya Decor**, a Bahrain
interior décor and fit-out company (~70 staff). It replaced a legacy ERP called
Q-Pro. It runs the whole business: a customer enquiry becomes a quotation,
gets costed by an estimator, approved, becomes a Job Card, gets routed to
production departments (Joinery, Upholstery, Painting, Curtain & Blinds),
gets budgeted, produced, QC'd, delivered, and invoiced.

It is a **PWA** — installed to the iPhone/iPad home screen by most staff, and
used on desktop by a few office roles. Vanilla JS/HTML/CSS, no framework, no
build step. Backed by Supabase (real login, real per-role permissions).

**Who uses it, and how:**
- **Owner (Salman)** — iPhone, constantly, on the move. Wants the state of the
  company in one glance.
- **Operations Manager** — the busiest user. Routes new jobs to departments,
  approves budgets, schedules deliveries, chases what's stuck.
- **Sales (3–4 people)** — iPhone. Create enquiries and quotations, watch their
  own jobs. They can never see cost, price entry, or supplier names (see
  "Hard rules" below).
- **Estimator (Arun Kumar)** — desktop only. Deep spreadsheet-like cost work:
  bills of material, labour, overhead, profit.
- **Approver** — reviews and approves quotations before they can become jobs.
- **Department managers (Joinery, Upholstery, Painting)** — a queue of work
  lines to start, submit for QC, pass/fail, hand off.
- **Shop floor roles** — Draftsman, Cutting List Team, Veneer Pressing, Curtain
  Tracks / QC / Install crews. Each sees exactly one stage's task list. These
  are deliberately bare — a table of what to do today, nothing else.
- **Storekeeper, Accounts, HR, Purchaser, Fleet Inspector, Admin** — each has
  their own dashboard.

There are **27 distinct roles plus Owner and Admin**. Each role signs in and
**lands directly on their own single dashboard** — there is no app-wide menu or
module picker. Their dashboard *is* the app for them.

---

## Current design system (what exists today)

- **Single brand accent: wine `#600131`** (ramp: `#600131` / `#7c1a4a` /
  `#9c3d6c`). This is the company's identity — keep it.
- **Light system**: page `#f5f6f8`, cards `#ffffff`, 14px radius, subtle shadow
  `0 1px 2px rgba(16,24,40,.04)`, system font stack.
- **Dark mode exists** for the Owner/Admin shell only (same wine hue family,
  accent brightened to `#a83c63` for contrast). A per-device toggle.
- **Semantic colours are kept separate from brand** and must stay distinct:
  green/amber/red for ok/warning/bad, plus a small set of categorical
  department colours used in legends.
- **Shell layout** (`exec-shell.js`): 230px left sidebar (brand mark, grouped
  nav with count badges, user chip), a topbar (title, date, theme toggle,
  chat, a reminders bell with a pulsing ring and badge, close ×), a floating
  chat bubble, and a reminders dropdown that auto-opens when something urgent
  is waiting. Below 880px the sidebar becomes a slide-in drawer behind a
  burger button.
- **Charts** are hand-rolled SVG/CSS — no charting library, and none may be
  added. Primitives available: ring gauges, mini bar charts, stacked monthly
  bars, horizontal bar lists.
- Cards are titled sections stacked vertically; KPI tiles are a grid of
  number + label.

---

## What Salman is unhappy about (the actual design problem)

In his own words, across several sessions:

1. *"The 3D ecosystem hub does not fit what we have built so far"* — that
   picker is now removed; roles land straight on their dashboard.
2. Dashboards feel **inconsistent and cluttered** — *"too much on one
   screen"*, scattered action buttons, duplicate messaging entry points, the
   same information presented differently in different modules.
3. **Operations looked broken** on iPhone — duplicated navigation chrome eating
   a third of the screen. Structurally fixed; visually it still needs a real
   design.
4. He wants a **cleaner, more structured** look overall. He liked a dashboard
   template with a sidebar app shell, reminder bell, and filter chips — but
   explicitly said **keep the wine + light identity, no purple**.
5. Several KPI cards are **not clickable** — a number with no way to see what's
   behind it.
6. Quick Actions are buried below the fold on some dashboards.

---

## What I want from you

**Produce several distinct visual/structural directions for this app's
dashboards** — not one polished answer. Iterate. Show me the range, then let me
pick. For each direction, give me a rendered HTML mockup I can look at on a
phone-width screen (390×844) and on desktop.

Design for **these three concrete screens**, so directions are comparable:

1. **Owner dashboard** — the widest, most information-dense. Real content:
   invoiced revenue this month with a month-over-month delta, open quote value
   and count, active jobs with an urgent count, receivables, a reminders count,
   a "My Tasks" card (task code, quick add, one-tap complete), monthly revenue
   by division (stacked bars), division share, a pipeline funnel
   (Quotation → Job Confirmed → In Production → Delivered), top clients,
   per-department quality ring gauges, and a recent activity feed.
2. **Operations Manager dashboard** — action-first. Lead with a queue of the
   five things needing a decision today (jobs awaiting routing, budgets
   awaiting approval, jobs with attention flags, curtain approvals, jobs ready
   to schedule), each as a row with a count, a one-line reason, and a chevron;
   steps with nothing waiting should collapse to a single muted line so the
   sequence stays visible. Numbers band below. Charts below that.
3. **A shop-floor role screen** (e.g. Joinery Cutting List Team) — one stage's
   task list. Deliberately minimal: what to do, on which job, and one action
   per row. This is the counterweight — show me you can restrain it.

**Explore genuinely different directions**, for example:
- Density: information-dense command centre vs. calm, few-things-per-screen.
- Structure: card grid vs. a single prioritised column vs. split
  "needs-you / for-reference".
- Navigation: persistent sidebar vs. bottom tab bar vs. a contextual header.
- How urgency reads: colour, position, a dedicated queue, or a bell.
- How a number becomes a drill-down (every KPI must lead somewhere).

---

## Hard constraints (these are not preferences)

- **Wine `#600131` stays** as the single brand accent. No purple, no second
  brand colour. Semantic red/amber/green stay distinct from brand.
- **Light theme is primary; dark must work too.** Style both — a viewer's
  theme toggle stamps `data-theme` on the root element.
- **Mobile-first.** Most users are on an iPhone. Respect the safe area
  (notch/Dynamic Island) at the top of full-screen views. Desktop matters only
  for the Estimator and a few office roles.
- **No external libraries, no CDN, no build step.** Self-contained HTML +
  inline CSS. Charts must be plain SVG/CSS. Any mockup you produce has to be
  implementable in vanilla JS that renders template strings.
- **Each role sees exactly one dashboard.** There is no global menu to fall
  back on — everything a role needs must be reachable from their own screen.
- **Sales must never see price, cost, or supplier/vendor names** anywhere.
  This is a fraud-prevention rule after a real incident — do not design a
  screen that surfaces a price to Sales, even in a summary.
- Currency is **BD (Bahraini Dinar), 3 decimal places** — e.g. `BD 1,350.000`.
  Dates read `DD MMM YYYY`.
- Keep existing structural language where it earns its place: titled cards,
  count badges on nav, pill-shaped status tags. Change it if you have a better
  idea, but say why.

---

## How to hand it back

For each direction: a short name, one paragraph on the idea and who it serves
best, then the three screens as rendered mockups (phone width primary, desktop
secondary). Call out explicitly what you changed from the current system and
what you deliberately kept. If a direction has a real weakness, say so — I'd
rather see three honest directions than three flattering ones.
