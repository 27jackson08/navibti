# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> dim surface >> dead share link has no accessibility violations
- Location: e2e/accessibility.spec.ts:56:11

# Error details

```
Error: stylesheet did not load — this scan would pass on an unstyled page

expect(received).not.toBe(expected) // Object.is equality

Expected: not ""
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]: Reading comfort
    - generic [ref=e5]:
      - group "Screen brightness" [ref=e6]:
        - button "Calm" [ref=e8]
        - button "Dim" [ref=e9]
        - button "Night" [ref=e10]
      - group "Text size" [ref=e11]:
        - button "A" [pressed] [ref=e13]
        - button "A" [ref=e14]
        - button "A" [ref=e15]
  - main [ref=e16]:
    - heading "This link isn’t active" [level=1] [ref=e17]
    - paragraph [ref=e18]: Shared plans expire on a date the patient sets, and can be switched off at any time. This one is no longer open — which may mean it has expired, may mean it was turned off, or may mean the address was mistyped.
    - paragraph [ref=e19]: Nothing has gone wrong with the patient’s record. Ask them to send a new link, and it will show their current plan rather than the one this address pointed at.
    - paragraph [ref=e20]:
      - strong [ref=e21]: If you are worried about someone right now
      - text: ", do not wait for a link. Get urgent medical care, and call emergency services if symptoms are severe or worsening quickly."
    - link "← NaviTBI" [ref=e22] [cursor=pointer]:
      - /url: /
  - alert [ref=e23]
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright';
  2   | import { expect, test, type Page } from '@playwright/test';
  3   | 
  4   | /**
  5   |  * Accessibility is a functional requirement here, not polish. The users are
  6   |  * photophobic and cognitively fatigued, so these run across every surface
  7   |  * rather than only the default one — a palette that passes in "calm" and fails
  8   |  * in "dim" has failed for exactly the people who need dim.
  9   |  */
  10  | 
  11  | const PAGES = [
  12  |   { name: 'home', path: '/' },
  13  |   { name: 'how it works', path: '/how-it-works' },
  14  |   { name: 'today', path: '/maya/today' },
  15  |   { name: 'check-in', path: '/maya/check-in' },
  16  |   { name: 'school packet', path: '/maya/packet/school' },
  17  |   { name: 'caregiver packet', path: '/maya/packet/caregiver' },
  18  |   { name: 'clinician summary', path: '/daniel/clinician' },
  19  |   // Amara, not Maya: no mutating test touches her, so this scan sees a page
  20  |   // that does not depend on what else has run.
  21  |   { name: 'sharing', path: '/amara/sharing' },
  22  |   // A dead share link is a designed path, not an edge case — links expire on a
  23  |   // date the patient sets — so the page a recipient lands on is scanned like
  24  |   // any other. Any token works here: unknown, expired and revoked are
  25  |   // deliberately indistinguishable.
  26  |   { name: 'dead share link', path: '/s/not-a-real-token' },
  27  | ] as const;
  28  | 
  29  | const SURFACES = ['calm', 'dim', 'night'] as const;
  30  | 
  31  | async function setSurface(page: Page, surface: string) {
  32  |   await page.evaluate((value) => {
  33  |     document.documentElement.setAttribute('data-surface', value);
  34  |   }, surface);
  35  | }
  36  | 
  37  | /**
  38  |  * Fails loudly if the stylesheet did not load.
  39  |  *
  40  |  * Without this the contrast scans pass vacuously against an unstyled page —
  41  |  * default black on white clears every threshold, so a broken build reports as a
  42  |  * clean accessibility result. That happened: a stale `next start` served the
  43  |  * previous build's HTML against a rebuilt .next, every stylesheet 404ed, and
  44  |  * 21 scans came back green while measuring nothing.
  45  |  */
  46  | async function assertStylesLoaded(page: Page) {
  47  |   const token = await page.evaluate(() =>
  48  |     getComputedStyle(document.documentElement).getPropertyValue('--nv-ground').trim(),
  49  |   );
> 50  |   expect(token, 'stylesheet did not load — this scan would pass on an unstyled page').not.toBe('');
      |                                                                                           ^ Error: stylesheet did not load — this scan would pass on an unstyled page
  51  | }
  52  | 
  53  | for (const surface of SURFACES) {
  54  |   test.describe(`${surface} surface`, () => {
  55  |     for (const target of PAGES) {
  56  |       test(`${target.name} has no accessibility violations`, async ({ page }) => {
  57  |         await page.goto(target.path);
  58  |         await assertStylesLoaded(page);
  59  |         await setSurface(page, surface);
  60  | 
  61  |         const results = await new AxeBuilder({ page })
  62  |           .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  63  |           .analyze();
  64  | 
  65  |         expect(
  66  |           results.violations.map((violation) => ({
  67  |             id: violation.id,
  68  |             impact: violation.impact,
  69  |             nodes: violation.nodes.map((node) => node.html.slice(0, 120)),
  70  |           })),
  71  |         ).toEqual([]);
  72  |       });
  73  |     }
  74  |   });
  75  | }
  76  | 
  77  | test.describe('reading comfort', () => {
  78  |   test('applies the stored surface before first paint', async ({ page }) => {
  79  |     await page.goto('/');
  80  |     await page.evaluate(() => localStorage.setItem('navitbi-surface', 'dim'));
  81  |     await page.goto('/maya/today');
  82  | 
  83  |     // Set by the inline bootstrap script, not by React after hydration.
  84  |     await expect(page.locator('html')).toHaveAttribute('data-surface', 'dim');
  85  |   });
  86  | 
  87  |   test('the surface control actually changes the surface when clicked', async ({ page }) => {
  88  |     // This was a coverage hole found by hand: the suite verified the bootstrap
  89  |     // script and set data-surface directly for the axe scans, but never checked
  90  |     // that clicking the control does anything.
  91  |     await page.goto('/maya/today');
  92  |     await expect(page.locator('html')).not.toHaveAttribute('data-surface', 'dim');
  93  | 
  94  |     await page.getByRole('button', { name: 'Dim', exact: true }).click();
  95  | 
  96  |     await expect(page.locator('html')).toHaveAttribute('data-surface', 'dim');
  97  |     await expect(page.getByRole('button', { name: 'Dim', exact: true })).toHaveAttribute(
  98  |       'aria-pressed',
  99  |       'true',
  100 |     );
  101 | 
  102 |     // And it survives a navigation, which is the whole point of storing it.
  103 |     await page.goto('/maya/packet/school');
  104 |     await expect(page.locator('html')).toHaveAttribute('data-surface', 'dim');
  105 |   });
  106 | 
  107 |   test('the text size control persists across pages too', async ({ page }) => {
  108 |     await page.goto('/maya/today');
  109 |     await page.getByRole('button', { name: 'A', exact: true }).last().click();
  110 |     await expect(page.locator('html')).toHaveAttribute('data-text', 'larger');
  111 | 
  112 |     await page.goto('/maya/sharing');
  113 |     await expect(page.locator('html')).toHaveAttribute('data-text', 'larger');
  114 |   });
  115 | 
  116 |   test('text size control changes the rendered size', async ({ page }) => {
  117 |     await page.goto('/maya/today');
  118 |     const heading = page.locator('h1').first();
  119 |     const before = await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  120 | 
  121 |     await page.evaluate(() => document.documentElement.setAttribute('data-text', 'larger'));
  122 |     const after = await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  123 | 
  124 |     expect(after).toBeGreaterThan(before);
  125 |   });
  126 | 
  127 |   test('ships no motion by default', async ({ page }) => {
  128 |     await page.goto('/maya/today');
  129 |     const duration = await page.evaluate(() =>
  130 |       getComputedStyle(document.documentElement).getPropertyValue('--duration-normal').trim(),
  131 |     );
  132 |     // Chrome normalises 0ms to 0s, so compare the value rather than the string.
  133 |     expect(parseFloat(duration)).toBe(0);
  134 |   });
  135 | });
  136 | 
  137 | test.describe('keyboard', () => {
  138 |   test('every check-in answer is reachable and operable by keyboard', async ({ page }) => {
  139 |     await page.goto('/maya/check-in');
  140 | 
  141 |     // Tab until the primary action has focus, then activate it with the
  142 |     // keyboard alone — a patient who cannot tolerate a screen may well be
  143 |     // navigating without a mouse.
  144 |     const none = page.getByRole('button', { name: 'None of these' });
  145 |     await none.focus();
  146 |     await expect(none).toBeFocused();
  147 |     await page.keyboard.press('Enter');
  148 | 
  149 |     await expect(page.getByRole('heading', { level: 2 })).toContainText('symptoms right now');
  150 | 
```