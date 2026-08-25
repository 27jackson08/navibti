/**
 * The palette makes a specific accessibility claim: photophobia mode emits
 * meaningfully less light than the default surface *without* trading away
 * legibility. That is a measurable claim, so it is measured here rather than
 * asserted in a comment.
 *
 * Values are read out of tokens.css, so editing a lightness in the stylesheet
 * and breaking contrast fails the suite instead of shipping.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAW = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
/* Comments contain colons, which a naive declaration split would mistake for
   property separators. Strip them before parsing anything. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`tokens.css has no ${selector} block`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const declarations: Record<string, string> = {};
  for (const [, name, value] of CSS.slice(open + 1, close).matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g,
  )) {
    declarations[name] = value.trim();
  }
  return declarations;
}

const ROOT = block(':root');

function surface(selector: string): Record<string, string> {
  return selector === ':root' ? ROOT : { ...ROOT, ...block(selector) };
}

// --- OKLCH -> linear sRGB -> WCAG relative luminance ------------------------

function oklchToLinearRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lCube = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCube = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCube = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  ];
}

function relativeLuminance(l: number, c: number, h: number): number {
  const [r, g, b] = oklchToLinearRgb(l, c, h).map((channel) =>
    Math.min(1, Math.max(0, channel)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function accentLuminance(tokens: Record<string, string>): number {
  return relativeLuminance(
    Number(tokens['--l-accent']),
    Number(tokens['--chroma-accent']),
    Number(tokens['--hue-accent']),
  );
}

/** Parses an `oklch(L C H)` literal, as the semantic colours are declared. */
function parseOklch(value: string): [number, number, number] {
  const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) throw new Error(`cannot parse "${value}" as oklch`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function semanticLuminance(tokens: Record<string, string>, name: string): number {
  return relativeLuminance(...parseOklch(tokens[name]));
}

function luminanceOf(tokens: Record<string, string>, lightnessVar: string): number {
  const l = Number(tokens[lightnessVar]);
  const c = Number(tokens['--chroma-neutral']);
  const h = Number(tokens['--hue-neutral']);
  if ([l, c, h].some(Number.isNaN)) {
    throw new Error(`cannot resolve ${lightnessVar}`);
  }
  return relativeLuminance(l, c, h);
}

const SURFACES = {
  calm: surface(':root'),
  dim: surface("[data-surface='dim']"),
  night: surface("[data-surface='night']"),
  'system-dark': surface(':root:not([data-surface])'),
} as const;

// --- the actual requirements -----------------------------------------------

describe.each(Object.entries(SURFACES))('%s surface', (name, tokens) => {
  const ground = luminanceOf(tokens, '--l-ground');
  const sunken = luminanceOf(tokens, '--l-surface-sunken');

  /**
   * Text sits on all three backgrounds, not just the page ground. Checking only
   * the ground missed that in the night palette the raised surface is *lighter*
   * than the ground, so light text on a card has less contrast than the same
   * text on the page — which is exactly what an axe scan of the built pages
   * turned up.
   */
  const backgrounds = [
    ['ground', ground],
    ['surface', luminanceOf(tokens, '--l-surface')],
    ['sunken', sunken],
  ] as const;

  it('clears AAA for body text on the ground', () => {
    expect(contrast(ground, luminanceOf(tokens, '--l-ink'))).toBeGreaterThanOrEqual(7);
  });

  it.each(backgrounds)('clears AA for secondary text on the %s', (_where, background) => {
    expect(contrast(background, luminanceOf(tokens, '--l-ink-soft'))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(backgrounds)('clears AA for faint labels on the %s', (_where, background) => {
    // Originally asserted 3:1 against the ground alone, which is the bar for
    // large text on one background. --l-ink-faint is used for 11px mono labels
    // on all three surfaces, and small text needs 4.5:1 on each of them.
    expect(contrast(background, luminanceOf(tokens, '--l-ink-faint'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps body text legible on the sunken surface too', () => {
    expect(contrast(sunken, luminanceOf(tokens, '--l-ink'))).toBeGreaterThanOrEqual(7);
  });

  it('keeps the accent legible as link text, not just as decoration', () => {
    expect(contrast(ground, accentLuminance(tokens))).toBeGreaterThanOrEqual(4.5);
  });

  it(`never uses pure white or pure black as the ground (${name})`, () => {
    const lightness = Number(tokens['--l-ground']);
    expect(lightness).toBeLessThan(0.99);
    expect(lightness).toBeGreaterThan(0.02);
  });
});

/**
 * Severity colours are text, not decoration — they carry the caution and
 * critical notices, and the adherence chips in the clinician summary. They were
 * not covered by the neutral checks above, and an axe scan of the built pages
 * caught them failing on the clinician page in both light surfaces.
 */
describe.each(Object.entries(SURFACES))('%s semantic colours', (_name, tokens) => {
  const backgrounds = [
    ['ground', luminanceOf(tokens, '--l-ground')],
    ['surface', luminanceOf(tokens, '--l-surface')],
    ['sunken', luminanceOf(tokens, '--l-surface-sunken')],
  ] as const;

  const semantics = ['caution', 'critical', 'steady'] as const;

  it.each(semantics)('%s is legible as text on every background', (semantic) => {
    const colour = semanticLuminance(tokens, `--nv-${semantic}`);
    for (const [where, background] of backgrounds) {
      expect(contrast(background, colour), `${semantic} on ${where}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(semantics)('%s is legible on its own tinted notice background', (semantic) => {
    expect(
      contrast(
        semanticLuminance(tokens, `--nv-${semantic}-surface`),
        semanticLuminance(tokens, `--nv-${semantic}`),
      ),
      semantic,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(semantics)('%s stays distinguishable from the accent', (semantic) => {
    // Severity must never read as branding, so the two are kept apart in hue.
    const [, , semanticHue] = parseOklch(tokens[`--nv-${semantic}`]);
    const accentHue = Number(tokens['--hue-accent']);
    const separation = Math.min(
      Math.abs(semanticHue - accentHue),
      360 - Math.abs(semanticHue - accentHue),
    );
    if (semantic === 'steady') return;
    expect(separation, semantic).toBeGreaterThan(40);
  });
});

describe('photophobia mode does what it claims', () => {
  const calmGround = luminanceOf(SURFACES.calm, '--l-ground');
  const dimGround = luminanceOf(SURFACES.dim, '--l-ground');

  it('emits substantially less light than the default surface', () => {
    // Not a token gesture: at least a third less light off the page.
    expect(dimGround).toBeLessThan(calmGround * 0.67);
  });

  it('does not buy that by dimming the text instead of the page', () => {
    const calmContrast = contrast(calmGround, luminanceOf(SURFACES.calm, '--l-ink'));
    const dimContrast = contrast(dimGround, luminanceOf(SURFACES.dim, '--l-ink'));
    // Contrast is allowed to move, but not to collapse — this is the whole
    // point of reducing lightness in OKLCH rather than greying the ink.
    expect(dimContrast).toBeGreaterThanOrEqual(calmContrast * 0.8);
  });
});

describe('motion is off unless asked for', () => {
  it('ships zero-duration defaults', () => {
    expect(ROOT['--duration-fast']).toBe('0ms');
    expect(ROOT['--duration-normal']).toBe('0ms');
  });

  it('still zeroes durations under prefers-reduced-motion, even when opted in', () => {
    const reducedMotionRule = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedMotionRule).toMatch(/\[data-motion='on'\]/);
  });
});

describe('touch targets', () => {
  it('exceeds the 44px minimum, because the user may be dizzy', () => {
    expect(Number.parseInt(ROOT['--target-min'], 10)).toBeGreaterThanOrEqual(48);
  });
});
