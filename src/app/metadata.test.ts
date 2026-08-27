import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listPatients } from '@/db/store';

/**
 * A tab title is the least private string in a browser.
 *
 * It lands in history, in a screen share, in a screenshot of a taskbar, and in
 * whatever a school's managed browser syncs upstream. So NaviTBI's titles say
 * what a document is and never who it is about — which still tells an
 * administrator with twelve tabs open which one is the accommodations letter.
 *
 * Every page had the layout's bare "NaviTBI" before this, which was private by
 * accident rather than by decision. Asserting it makes it a decision.
 */
const APP = new URL('./', import.meta.url);

function pageFiles(dir: URL, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) pageFiles(child, found);
    else if (entry.name === 'page.tsx') found.push(child.pathname.slice(APP.pathname.length));
  }
  return found;
}

const pages = pageFiles(APP);

describe('what a browser tab says', () => {
  it('finds the pages', () => {
    expect(pages.length).toBeGreaterThan(5);
  });

  it.each(pages)('%s names a document, not a person', (path) => {
    const source = readFileSync(new URL(path, APP), 'utf8');
    const titles = [...source.matchAll(/title:\s*(?:`([^`]*)`|'([^']*)')/g)].map(
      (m) => m[1] ?? m[2],
    );

    for (const title of titles) {
      for (const patient of listPatients()) {
        expect(title, `${path} puts a patient name in a title`).not.toContain(patient.displayName);
      }
      // Interpolation is where a name would arrive if one ever did.
      expect(title, `${path} interpolates into a title`).not.toMatch(/\$\{/);
    }
  });

  it.each(
    pages.filter((path) => path !== 'page.tsx'),
  )('%s distinguishes itself from every other tab', (path) => {
    const source = readFileSync(new URL(path, APP), 'utf8');
    expect(source, `${path} inherits the bare default title`).toMatch(
      /export const metadata|export async function generateMetadata/,
    );
  });

  it('keeps a shared clinical document out of search results', () => {
    const share = readFileSync(new URL('s/[token]/page.tsx', APP), 'utf8');
    expect(share).toMatch(/robots:\s*\{[^}]*index:\s*false/);

    // The meta tag only reaches a crawler that renders HTML.
    const middleware = readFileSync(new URL('../../middleware.ts', APP), 'utf8');
    expect(middleware).toContain('x-robots-tag');
  });
});
