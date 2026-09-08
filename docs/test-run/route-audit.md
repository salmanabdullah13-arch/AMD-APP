# Route audit — every destination against what the role lands on today

Generated 2026-09-08 16:10 by `route-audit.js`.

Derived from `NODES` in index.html — what is built, what is retired, and
what `supersededBy` says replaced it. Nothing here is a second hand-kept
list. Deliberate links to a legacy module are declared in the script with
a reason each.

## Result

**All clear** — 11 checks.

## Modules superseded

| Legacy | Replaced by | Still built |
|---|---|---|
| Storekeeper (old stock pool) | store | yes |
| Upholstery (old pipeline view) | upholstery | no |
| Joinery (old pipeline view) | production | no |
| Painting (retired — see Production) | production | no |
| Joinery – Draftsman | production | no |
| Joinery – Cutting List Team | production | no |
| Joinery – Veneer Pressing Team | production | no |
| Joinery – Floor Overview | production | no |

## Deliberate links to a legacy module

- **`ownerGoToMasters`** (owner.js) — Masters — units, categories, catalogue — still lives in the legacy module; the 18a build did not move it.
- **`execGoStock`** (exec-shell.js) — Falls back to the legacy dashboard only when StoreUI is not loaded; the 18a Reminders page is the real destination.

## Every hop at a legacy module found in source

| File | Line | Target | Replaced by | Declared |
|---|---|---|---|---|
| owner.js | 133 | `launchStorekeeperModule` | store | yes |