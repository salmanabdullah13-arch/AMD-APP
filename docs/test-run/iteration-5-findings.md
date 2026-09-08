# Iteration 5 — regression, 8 Sep 2026

The three drivers re-run against the current build, after the Store module,
the Approver landing rework, the planner redraw fix, the Accounts formatting
and the route audit. Same discipline as before: every step as the role that
does it, each cloud-backed record checked three ways — the data layer holds
it, the live table holds it, and the next role's session sees it arrive.

| Iteration | Result |
|---|---|
| 1 — the five happy-path suites | **155/155** |
| 2 — the fifteen exception branches | **221/221** |
| 3 — the twelve adversarial attacks | **180/180** |

No refused write, no console error and no toast in any role's session across
the three runs. The run's residue was purged afterwards: 553 rows, verified
clean.

## One check corrected, and why it is a fixture fault rather than a defect

Iteration 3's A7 asks whether a role's landing screen redraws once the
caches land after a reload — the check that found F19 in the first place.
Owner's probe looked for the run's own project name, `RUN1 A7`.

That worked when the project held a handful of job cards. Owner's landing is
the 4a dashboard: a KPI band, charts, and Top Clients — and Top Clients is
**ranked**. Once the project holds sixty-odd job cards a freshly created one
legitimately does not appear in the top six, so the needle stopped being
found for a reason that has nothing to do with whether the screen redrew.
The state captured alongside the failure said as much: signed in, session
live, 63 job cards hydrated, the Owner wrap on screen.

The check now looks for what that landing genuinely prints and what proves
the redraw carried hydrated data — the band's own **Active Jobs** figure,
computed off the loaded job cards, being non-zero. Same intent, no dependence
on how much data the project happens to hold.

This is the third fixture of this shape found in three days: the upholstery
serial-line check assuming two working days either side of a weekend are one
calendar day apart, the production-flows check whose "Monday" collided with
an earlier block, and now this one. All three passed for weeks and then began
failing on the state of the world rather than the state of the code. Worth
naming as a class: **a check whose expectation depends on today's date, or on
how much data the project holds, will eventually fail for a reason that is
not a defect** — and each one costs a diagnosis before it can be dismissed.

## Nothing else changed

Every finding from iterations 1–4 stayed closed. The delegation-without-a-
reason NOTE in iteration 2 is Salman's own decision (13 Sep answer: keep it
optional), not an open item.
