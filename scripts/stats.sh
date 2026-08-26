#!/usr/bin/env bash
# Current counts, so prose does not have to guess. Only README.md and
# docs/devpost.md should quote these.
#
# Exits non-zero if either number cannot be read. It used to print "?" and
# succeed, which is the same failure this repo has already been bitten by twice:
# a measurement that returns something rather than nothing, and gets quoted.
# A red suite produces no match either, so a failing test run cannot be
# mistaken here for a passing one with an unreadable count.
set -uo pipefail
cd "$(dirname "$0")/.."

unit_output=$(npx vitest run 2>&1)
unit=$(printf '%s\n' "$unit_output" | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+' | head -1)

e2e_output=$(npx playwright test --list 2>&1)
e2e=$(printf '%s\n' "$e2e_output" | grep -oE 'Total: [0-9]+' | grep -oE '[0-9]+' | head -1)

status=0
if [ -z "$unit" ]; then
  echo "could not read a unit test count -- last lines of the run:" >&2
  printf '%s\n' "$unit_output" | tail -12 >&2
  status=1
fi
if [ -z "$e2e" ]; then
  echo "could not read an e2e test count -- last lines of the listing:" >&2
  printf '%s\n' "$e2e_output" | tail -12 >&2
  status=1
fi

echo "unit tests: ${unit:-unreadable}"
echo "e2e tests:  ${e2e:-unreadable}"
exit "$status"
