#!/bin/bash
# A suite that CRASHES prints no "N/N checks passed" line at all. The old
# one-liner compared two empty strings and called that green — which is how a
# broken suite went unnoticed for a commit. Treat "no result line" as a failure.
FAILED=""
for f in $(ls e2e-*.js | grep -v cloud | grep -v -- "-rls" | grep -v signup-approval | grep -v role-gating | grep -v age-gate | grep -v roster-filter); do
  out=$(node "$f" 2>&1)
  line=$(echo "$out" | grep -oP '\d+/\d+ checks passed' | tail -1)
  if [ -z "$line" ]; then
    FAILED="$FAILED\n  $f  NO RESULT (crashed): $(echo "$out" | grep -m1 -E 'Error|error:' | cut -c1-90)"
  else
    a=${line%%/*}; b=${line#*/}; b=${b%% *}
    [ "$a" != "$b" ] && FAILED="$FAILED\n  $f  $line"
  fi
done
echo -e "SWEEP:${FAILED:- all green}"
