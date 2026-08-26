<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## NaviTBI conventions

**The guideline layer is not ordinary code.** Everything under `src/data/guidelines`
is a transcription of published clinical guidance. Do not "improve" the wording,
round the numbers, or add a value that no cited document states. If a number is
ours rather than the literature's, it is tagged `provenance: 'product-default'`
and must carry a `rationale`. Guideline values must carry a verbatim `quote`.
`src/data/guidelines/guidelines.test.ts` enforces both.

**The model may never widen what the guideline permits.** The stage machine
decides what is allowed; the tolerance model only picks a dose inside it.
Recommended dose is `min(model tolerance, ramp cap, stage cap)`.

**Never generate clinical claims.** Accommodation text is selected from
`src/data/accommodations`, never written by a language model. An LLM tone pass
may only rephrase items already selected, behind a validator.

**Four things are never cut:** the red-flag interrupt, the stage machine, the
not-medical-advice framing, and citations on every output.

**Design tokens encode accessibility requirements, not preferences.** Contrast,
photophobia mode, motion defaults, and target sizes are verified by
`src/styles/contrast.test.ts`, which computes real WCAG ratios from the OKLCH
values in `tokens.css`. If you change a lightness, run the tests.

Commands: `npm run dev` · `npm test` · `npm run typecheck` · `npm run build`
Plan: see `PLAN.md`.

## Verification

```
npm run verify           # typecheck + lint + unit
npm run verify -- --full # ...and the e2e suite across Chromium, Firefox, WebKit

npm test        # unit tests: guideline data, engine, tokens
npm run e2e     # Playwright: axe on 7 pages x 3 surfaces, journeys, responsive
npm run eval    # synthetic cohort -> results/evaluation.md
npm run packets # print the packets each demo persona receives
npm run trace   # one patient's day-by-day engine trace
```

Accessibility is enforced in two places and both are needed. The token tests in
`src/styles/contrast.test.ts` compute WCAG ratios from the OKLCH values; the axe
scan in `e2e/accessibility.spec.ts` checks the built pages. The token tests
passed while three real contrast defects were live — see
`results/frontend-audit.md`.

**Do not verify with a pipe.** `npx vitest run | grep Tests && git commit` will
commit a red suite: the pipe masks vitest's exit code, and grep's success becomes
the chain's success. `set -e` does not reliably rescue this either. That is what
`npm run verify` is for — it captures each gate's exit code directly.

**Tests read `seededOn` from the store, never the clock.** The seeded demo
histories are positioned against the moment the store initialised; a test that
computes its own "today" disagrees with that once a day, across UTC midnight.

**Counts in prose go stale.** `npm run stats` prints the current test and source
counts; run it before quoting a number in README.md or docs/devpost.md, which are
the only two files that should carry one.
