#!/usr/bin/env bash
# Runs every gate and reports which failed.
#
# Written because a chain like `npx vitest run | grep Tests && git commit` will
# happily commit a red suite: the pipe masks vitest's exit code and grep's
# success becomes the chain's success. That happened once. Exit codes are
# captured explicitly here, and nothing is piped.
fail=0

# A stray `next start` from another task holds port 3000 and the whole e2e run
# dies on startup — reuseExistingServer is off deliberately, so there is nothing
# to fall back to. This has cost three runs now.
pkill -f "next start" >/dev/null 2>&1 || true
pkill -f "next-server" >/dev/null 2>&1 || true
sleep 1
run() {
  local name="$1"; shift
  if "$@" > /tmp/navitbi-verify.log 2>&1; then
    echo "  ok    $name"
  else
    echo "  FAIL  $name"
    tail -20 /tmp/navitbi-verify.log | sed 's/^/        /'
    fail=1
  fi
}

run "typecheck" npx tsc --noEmit
run "lint"      npx eslint src scripts e2e --max-warnings=0
run "unit"      npx vitest run
[ "${1:-}" = "--full" ] && run "e2e" npx playwright test

if [ "$fail" -eq 0 ]; then echo "ALL GREEN"; else echo "SOMETHING FAILED"; exit 1; fi
