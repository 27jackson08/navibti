# Frontend audit

Reproduce with `npm run e2e`. Measured against the production build, not the dev
server, because contrast, focus order and layout are properties of what ships.

## Accessibility

`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

| | |
|---|---|
| Pages scanned | 7 |
| Surfaces per page | 3 (calm, dim, night) |
| Scans | 21 |
| **Violations** | **0** |

Also asserted:

- Keyboard operation of the check-in without a mouse, and a visible focus ring
  on every focusable element
- No horizontal overflow at 320, 375, 768, 1024 and 1440 px on every page
- Zero motion duration by default, honoured even when motion is opted into and
  the reader has `prefers-reduced-motion` set
- The stored surface is applied by an inline script before first paint, and the
  surface and text-size controls persist across navigation

### Three defects this found

The token unit tests passed throughout while all three of these were live, which
is the argument for scanning the built pages rather than trusting the palette
maths alone.

1. **`--l-ink-faint` was tested at 3:1 and used at 12px.** 3:1 is the bar for
   large text; small text needs 4.5:1. The unit test was measuring the wrong
   threshold for the actual usage.
2. **Contrast was only ever checked against the page ground.** Text also sits on
   raised and sunken surfaces, and in the night palette the raised surface is
   *lighter* than the ground — so text on a card had less contrast than the same
   text on the page. All three backgrounds are now checked.
3. **The semantic colours were never contrast-checked at all.** Caution,
   critical and steady carry the notices and the adherence chips in the clinician
   summary, and two of them failed on both light surfaces.

Fixing (2) also exposed a design problem rather than only a numeric one: in the
dim palette, secondary and faint text solved to the same lightness, which would
have flattened the type hierarchy exactly where legibility matters most. The dim
surfaces were brought closer together to make room for both.

## Bundle

First load, gzipped, measured over the wire.

| Page | JS | CSS |
|---|---|---|
| Home | 173.9 KB | 6.5 KB |
| Today | 173.9 KB | 6.5 KB |
| Check-in | 177.2 KB | 6.5 KB |
| Packet | 173.9 KB | 6.5 KB |

Against the budgets in `PLAN.md`: CSS comes in at roughly a fifth of its 30 KB
allowance. JS **misses the 150 KB landing-page budget by about 24 KB** and sits
comfortably inside the 300 KB app-page budget.

Stated plainly rather than quietly reclassified: the figure is essentially the
Next.js App Router baseline. Almost every page is a server component, and the
only client-side JavaScript the product itself ships is the check-in flow, the
reading-comfort controls and the revoke confirmation. Getting under 150 KB would
mean changing framework, which is not a trade worth making for this.

## Not covered

- No Lighthouse run. The performance numbers above are direct measurements;
  field metrics (LCP, INP, CLS) have not been collected and are not claimed.
- Screen-reader testing is automated only. Axe catches missing names, roles and
  contrast; it does not tell you whether a screen reader experience is *good*.
- One browser. Chromium only, no Firefox or WebKit run.
