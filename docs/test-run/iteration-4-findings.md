# End-to-end run — iteration 4 (regression)

Iterations 1 and 2 re-driven on the build as it stands after every fix
from iterations 1–3, the Production fold, the discount tiers, the
notifications by role, the reload redraw, the typing fix, the design
scorecard and the Curtain restyle — then every live cloud suite and the
full offline sweep.

| Pass | Result | Notes |
|---|---|---|
| Iteration 1 (five happy-path suites, fourteen roles) | **155/155** | No refused writes, no console errors, no toasts in any role's session. |
| Iteration 2 (fifteen exception branches) | **221/221** | The one check iteration 2 could not pass on its own build (F9, a 40% discount at the data layer) passes now: the tiers refuse it. One error-section entry: the driver's X15 delegates to `"Arun Kumar A"`, a payroll spelling that is not a login; the app now refuses the notification and surfaces it as a toast, which is F17 working, not a defect. |
| Live cloud suites (17) | **17/17 green** | `e2e-cloud-login.js` read 5/6 inside the batch and 6/6 standalone — a live-network flake on its sign-up step, not a defect. |
| Offline sweep (61 suites) | all green | Run after the Curtain restyle, the last code change. |
| Design scorecard | 28 screens, 0 flagged | Re-run after the Curtain restyle. |

## What the regression confirms

- Every finding fixed during the run stays fixed under the flows that
  found it: the column-level job-card and quotation sync (F10), the
  per-job fabric ticket (F11), the delivery-note refusal (F12), the four
  persisted job-card fields (F14), the clock's 100% refusal (F15), the
  production-side reservations (F16), the discount tiers (F9), the role
  notifications (F17), the hydration redraw (F19).
- The Production fold changed where seven roles land without changing
  what the flows do: iteration 1's joinery and painting steps drive the
  same data functions and land the same records.
- The Curtain restyle changed frames, not behaviour: the curtain suite
  and the two Curtain-involving happy paths pass unchanged.

## Still open after four iterations

- **The 18a Store Keeper interface** (never built — the storekeeper still
  lands on the legacy stock-pool screen while a gated data layer waits).
- **The Approver's landing** (counts instead of the queue).
- **F1, design-level**: ids are minted client-side before the caches
  hydrate; max-based minting has held since the fix, but a job confirmed
  in the first seconds after login could still collide.
- The camera and phone flows on a real device, which Salman asked to do
  last; the PAT to revoke once he has.
