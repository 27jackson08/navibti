import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Numbers quoted in prose, checked against the thing they describe.
 *
 * Three documents claimed three different axe-scan counts — 21, 63 and 72 —
 * and none of them was right. Each was correct when written and none was
 * updated when a page or a browser engine was added. Prose does not fail a
 * build, so this does.
 *
 * Only counts that can be derived from the repo belong here. Evaluation results
 * come from `npm run eval` against a simulated cohort and are not recomputable
 * in a unit test; those stay the responsibility of re-running the harness.
 */
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function axeScanCount(): number {
  const spec = read('e2e/accessibility.spec.ts');
  const config = read('playwright.config.ts');

  const pages = spec.split('const PAGES = [')[1].split('] as const')[0];
  const pageCount = [...pages.matchAll(/^\s*\{\s*name:/gm)].length;

  const surfaces = spec.split('const SURFACES = [')[1].split(']')[0];
  const surfaceCount = [...surfaces.matchAll(/'[^']+'/g)].length;

  // Chromium runs every spec; the other engines are restricted to this one.
  const engineCount = [...config.matchAll(/name: '(chromium|firefox|webkit)'/g)].length;

  expect(pageCount, 'PAGES parsed').toBeGreaterThan(1);
  expect(surfaceCount, 'SURFACES parsed').toBeGreaterThan(1);
  expect(engineCount, 'engines parsed').toBeGreaterThan(1);

  return pageCount * surfaceCount * engineCount;
}

describe('numbers quoted in the write-ups', () => {
  const DOCS = ['README.md', 'docs/devpost.md', 'docs/navitbi-brief.html'];

  it('agrees with itself about how many axe scans there are', () => {
    const expected = axeScanCount();

    for (const doc of DOCS) {
      const text = read(doc);
      const quoted = [...text.matchAll(/(\d+)\s*axe scans/g)].map((m) => Number(m[1]));

      expect(quoted.length, `${doc} quotes an axe scan count`).toBeGreaterThan(0);
      for (const value of quoted) {
        expect(value, `${doc} quotes ${value} axe scans, actual is ${expected}`).toBe(expected);
      }
    }
  });

  it('still states the narrower positioning claim out loud', () => {
    // MyBrainPacer and Parkwood hold "first personalised pacing app"; ours is
    // "first closed-loop accommodation translator". Asserting the wrong claim
    // is *absent* would be regex-as-semantics — the devpost names it precisely
    // in order to disclaim it, and a matcher cannot tell those apart. So this
    // checks the narrower claim is present, which is a fact about the text.
    expect(read('docs/devpost.md').toLowerCase()).toMatch(
      /first closed-loop accommodation/,
    );
  });
});
