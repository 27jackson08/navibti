#!/usr/bin/env bash
# Current counts, so prose does not have to guess. Only README.md and
# docs/devpost.md should quote these.
cd "$(dirname "$0")/.."
unit=$(npx vitest run 2>&1 | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
e2e=$(npx playwright test --list 2>&1 | grep -oE 'Total: [0-9]+' | grep -oE '[0-9]+')
echo "unit tests: ${unit:-?}"
echo "e2e tests:  ${e2e:-?}"
