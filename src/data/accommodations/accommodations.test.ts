import { describe, expect, it } from 'vitest';
import { CITATIONS, PROTOCOLS } from '../guidelines';
import {
  ACCOMMODATION_LIBRARY,
  ACCOMMODATIONS_BY_ROLE,
  ACCOMMODATION_PLACEHOLDERS,
  PLACEHOLDER_PATTERN,
  TOLERANCE_BANDS,
  allowedClaimIds,
} from './index';

describe('library integrity', () => {
  it('is seeded across all three roles', () => {
    expect(ACCOMMODATION_LIBRARY.length).toBeGreaterThanOrEqual(30);
    for (const [role, items] of Object.entries(ACCOMMODATIONS_BY_ROLE)) {
      expect(items.length, `${role} has no accommodations`).toBeGreaterThan(5);
    }
  });

  it('has globally unique ids', () => {
    const ids = ACCOMMODATION_LIBRARY.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('files every item under the role its id declares', () => {
    for (const [role, items] of Object.entries(ACCOMMODATIONS_BY_ROLE)) {
      for (const item of items) {
        expect(item.role).toBe(role);
      }
    }
  });
});

describe('every item is traceable', () => {
  it.each(ACCOMMODATION_LIBRARY)('$id cites a real source', (item) => {
    expect(CITATIONS).toHaveProperty(item.citation);
  });

  it.each(ACCOMMODATION_LIBRARY)('$id explains why, not just what', (item) => {
    expect(item.rationale.length).toBeGreaterThan(20);
  });

  it.each(ACCOMMODATION_LIBRARY)('$id sits in a valid step range', (item) => {
    const protocol = PROTOCOLS[item.protocol];
    expect(item.minStep).toBeGreaterThanOrEqual(1);
    expect(item.maxStep).toBeLessThanOrEqual(protocol.steps.length);
    expect(item.minStep).toBeLessThanOrEqual(item.maxStep);
  });

  it.each(ACCOMMODATION_LIBRARY)('$id applies to at least one tolerance band', (item) => {
    expect(item.bands.length).toBeGreaterThan(0);
    for (const band of item.bands) {
      expect(TOLERANCE_BANDS).toContain(band);
    }
  });
});

describe('placeholders can actually be filled', () => {
  it.each(ACCOMMODATION_LIBRARY)('$id uses only known slots', (item) => {
    const slots = [...item.text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]);
    for (const slot of slots) {
      expect(ACCOMMODATION_PLACEHOLDERS).toContain(slot);
    }
  });

  it('leaves no half-open mustache that would render as literal text', () => {
    for (const item of ACCOMMODATION_LIBRARY) {
      const opens = (item.text.match(/\{\{/g) ?? []).length;
      const closes = (item.text.match(/\}\}/g) ?? []).length;
      expect(opens, `${item.id} has unbalanced braces`).toBe(closes);
    }
  });
});

/**
 * The library is what a school office or a manager actually reads. It must not
 * drift into territory the product has no business occupying.
 */
describe('scope guardrails', () => {
  const FORBIDDEN: readonly [RegExp, string][] = [
    [/\bdiagnos(e|is|ed|ing)\b/i, 'diagnosis'],
    [/\bprescrib(e|ed|ing)\b/i, 'prescribing'],
    [/\bmedication|\bdosage\b|\bibuprofen\b|\bacetaminophen\b/i, 'medication advice'],
    [/\b(is|are|has been|have been) cleared\b/i, 'issuing clearance'],
    [/\bcleared (to|for)\b/i, 'issuing clearance'],
    [/\bsafe to return to (play|sport|contact)\b/i, 'clearing return to play'],
    [/\bMRI\b|\bCT scan\b|\bimaging\b/i, 'imaging advice'],
  ];

  it.each(ACCOMMODATION_LIBRARY)('$id stays inside scope', (item) => {
    const prose = `${item.text} ${item.rationale}`;
    for (const [pattern, label] of FORBIDDEN) {
      expect(pattern.test(prose), `${item.id} strays into ${label}: "${prose}"`).toBe(false);
    }
  });

  it('never places a school accommodation at return-to-learn step 4', () => {
    // Step 4 is defined as "no concussion-related accommodations". An item that
    // applied there would contradict the goal state of the protocol.
    const schoolItems = ACCOMMODATIONS_BY_ROLE.school.filter(
      (item) => item.protocol === 'return-to-learn' && item.domain !== 'physical',
    );
    for (const item of schoolItems) {
      expect(item.maxStep, `${item.id} still applies at step 4`).toBeLessThanOrEqual(3);
    }
  });
});

describe('allowedClaimIds', () => {
  it('bounds what a tone pass is permitted to say', () => {
    const selected = ACCOMMODATION_LIBRARY.slice(0, 3);
    const allowed = allowedClaimIds(selected);
    expect(allowed.size).toBe(3);
    expect(allowed.has(selected[0].id)).toBe(true);
    expect(allowed.has('some-invented-recommendation')).toBe(false);
  });
});

describe('accommodations whose wording carries numbers', () => {
  /**
   * Anything with a placeholder needs a name without one.
   *
   * Both echo-back surfaces — "you told us these aren't possible" on the
   * recipient's copy, and "reported unavailable" on the patient's plan — show
   * an accommodation that is no longer in today's packet. Rendering its
   * template with today's slots put a declined cap of one meeting on screen as
   * "Cap live meetings at 0 per day".
   */
  const quantified = ACCOMMODATION_LIBRARY.filter((item) => item.text.includes('{{'));

  it('finds the quantified items', () => {
    expect(quantified.length).toBeGreaterThan(5);
  });

  it.each(quantified.map((item) => [item.id, item] as const))(
    '%s has a label without numbers',
    (_id, item) => {
      expect(item.shortLabel, `${item.id} needs a shortLabel`).toBeDefined();
      expect(item.shortLabel).not.toMatch(/\{\{|\d/);
      expect(item.shortLabel!.length).toBeGreaterThan(11);
    },
  );

  it('does not carry a label where the text has no numbers to hide', () => {
    for (const item of ACCOMMODATION_LIBRARY) {
      if (item.text.includes('{{')) continue;
      expect(item.shortLabel, `${item.id} has a shortLabel it does not need`).toBeUndefined();
    }
  });
});
