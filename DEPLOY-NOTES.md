# Deploy notes

## Publishing
`git push origin main` → GitHub Pages' own "pages build and deployment" job
publishes to https://salmanabdullah13-arch.github.io/AMD-APP/ in ~1–2 minutes.
Confirm it actually landed:

    curl -s "https://salmanabdullah13-arch.github.io/AMD-APP/sw.js?nc=$(date +%s)" | grep CACHE_VERSION

That must match `CACHE_VERSION` in the local `sw.js`. If it doesn't, the deploy
hasn't landed — do NOT report the change as live.

**Bump `CACHE_VERSION` in `sw.js` whenever app files change.** It's both the
cache-busting key and the deploy-verification marker.

## Why there is no CI workflow (6 Aug 2026)
A GitHub Actions workflow running the full Playwright sweep on every push was
added and then REMOVED the same day: its runs failed at "Set up job" (runner
allocation) and, more importantly, they queued alongside the Pages build. With
several pushes in a row, each new push cancelled the in-flight Pages build
while the long test runs held the queue — the live site sat ~2.5 hours behind
`main` and Salman kept seeing the old UI on his iPhone.

Publishing beats automation here. The offline sweep runs locally before pushing
instead (CLAUDE.md's standing verification battery). If CI is wanted again:
use a `concurrency` group with `cancel-in-progress: true`, keep the job short,
and confirm a Pages deploy still completes promptly afterwards.

## Phone (iOS home-screen PWA)
The service worker is network-first, so a normal reload picks up new code. If a
device still looks stale: fully close the app from the app switcher and reopen;
if that fails, delete the home-screen icon and re-add it from Safari (clears the
cached shell).
