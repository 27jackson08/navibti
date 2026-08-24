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
