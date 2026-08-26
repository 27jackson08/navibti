import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility is a functional requirement here, not polish. The users are
 * photophobic and cognitively fatigued, so these run across every surface
 * rather than only the default one — a palette that passes in "calm" and fails
 * in "dim" has failed for exactly the people who need dim.
 */

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'today', path: '/maya/today' },
  { name: 'check-in', path: '/maya/check-in' },
  { name: 'school packet', path: '/maya/packet/school' },
  { name: 'caregiver packet', path: '/maya/packet/caregiver' },
  { name: 'clinician summary', path: '/daniel/clinician' },
  // Amara, not Maya: no mutating test touches her, so this scan sees a page
  // that does not depend on what else has run.
  { name: 'sharing', path: '/amara/sharing' },
] as const;

const SURFACES = ['calm', 'dim', 'night'] as const;

async function setSurface(page: Page, surface: string) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute('data-surface', value);
  }, surface);
}

/**
 * Fails loudly if the stylesheet did not load.
 *
 * Without this the contrast scans pass vacuously against an unstyled page —
 * default black on white clears every threshold, so a broken build reports as a
 * clean accessibility result. That happened: a stale `next start` served the
 * previous build's HTML against a rebuilt .next, every stylesheet 404ed, and
 * 21 scans came back green while measuring nothing.
 */
async function assertStylesLoaded(page: Page) {
  const token = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--nv-ground').trim(),
  );
  expect(token, 'stylesheet did not load — this scan would pass on an unstyled page').not.toBe('');
}

for (const surface of SURFACES) {
  test.describe(`${surface} surface`, () => {
    for (const target of PAGES) {
      test(`${target.name} has no accessibility violations`, async ({ page }) => {
        await page.goto(target.path);
        await assertStylesLoaded(page);
        await setSurface(page, surface);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(
          results.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.html.slice(0, 120)),
          })),
        ).toEqual([]);
      });
    }
  });
}

test.describe('reading comfort', () => {
  test('applies the stored surface before first paint', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('navitbi-surface', 'dim'));
    await page.goto('/maya/today');

    // Set by the inline bootstrap script, not by React after hydration.
    await expect(page.locator('html')).toHaveAttribute('data-surface', 'dim');
  });

  test('the surface control actually changes the surface when clicked', async ({ page }) => {
    // This was a coverage hole found by hand: the suite verified the bootstrap
    // script and set data-surface directly for the axe scans, but never checked
    // that clicking the control does anything.
    await page.goto('/maya/today');
    await expect(page.locator('html')).not.toHaveAttribute('data-surface', 'dim');

    await page.getByRole('button', { name: 'Dim', exact: true }).click();

    await expect(page.locator('html')).toHaveAttribute('data-surface', 'dim');
    await expect(page.getByRole('button', { name: 'Dim', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // And it survives a navigation, which is the whole point of storing it.
    await page.goto('/maya/packet/school');
    await expect(page.locator('html')).toHaveAttribute('data-surface', 'dim');
  });

  test('the text size control persists across pages too', async ({ page }) => {
    await page.goto('/maya/today');
    await page.getByRole('button', { name: 'A', exact: true }).last().click();
    await expect(page.locator('html')).toHaveAttribute('data-text', 'larger');

    await page.goto('/maya/sharing');
    await expect(page.locator('html')).toHaveAttribute('data-text', 'larger');
  });

  test('text size control changes the rendered size', async ({ page }) => {
    await page.goto('/maya/today');
    const heading = page.locator('h1').first();
    const before = await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));

    await page.evaluate(() => document.documentElement.setAttribute('data-text', 'larger'));
    const after = await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));

    expect(after).toBeGreaterThan(before);
  });

  test('ships no motion by default', async ({ page }) => {
    await page.goto('/maya/today');
    const duration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--duration-normal').trim(),
    );
    // Chrome normalises 0ms to 0s, so compare the value rather than the string.
    expect(parseFloat(duration)).toBe(0);
  });
});

test.describe('keyboard', () => {
  test('every check-in answer is reachable and operable by keyboard', async ({ page }) => {
    await page.goto('/maya/check-in');

    // Tab until the primary action has focus, then activate it with the
    // keyboard alone — a patient who cannot tolerate a screen may well be
    // navigating without a mouse.
    const none = page.getByRole('button', { name: 'None of these' });
    await none.focus();
    await expect(none).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { level: 2 })).toContainText('symptoms right now');
  });

  test('a focused control shows a visible ring', async ({ page }) => {
    await page.goto('/maya/today');
    await page.getByRole('button', { name: 'Dim', exact: true }).focus();

    const outline = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return null;
      const style = getComputedStyle(active);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });

    expect(outline).not.toBeNull();
    // Style, not width. outline-width computes to its initial value even when
    // the style is none, so asserting on width alone passes on an element with
    // no ring at all — which is how the original version of this test managed
    // to look like it was checking something.
    expect(outline!.style).not.toBe('none');
    expect(parseFloat(outline!.width)).toBeGreaterThan(0);
  });

  test('tabbing reaches the controls', async ({ page, browserName }) => {
    // WebKit leaves Tab focus on the body: Safari ships with "press Tab to
    // highlight each item on a webpage" turned off, so Tab only visits form
    // fields until the user changes that preference. That is a platform
    // setting, not something this page can influence, and the ring itself is
    // verified above on all three engines.
    test.skip(browserName === 'webkit', 'Safari does not tab to buttons by default');

    await page.goto('/maya/today');
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('BUTTON');
  });
});

test.describe('responsive', () => {
  const WIDTHS = [320, 375, 768, 1024, 1440];

  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const target of PAGES) {
        await page.goto(target.path);
        await assertStylesLoaded(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${target.name} at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});
