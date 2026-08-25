import { describe, expect, it } from 'vitest';
import { LOAD_DOMAINS } from '@/data/guidelines';
import { DOMAIN_QUESTIONS, DURATION_PRESETS, SLEEP_PRESETS, type Preset } from './check-in-presets';

/**
 * These presets are the only route real load data takes into the model. A value
 * that drifts out of order or out of the range the server action validates
 * would corrupt every estimate downstream without any visible failure, so the
 * contract is pinned here rather than left to the end-to-end test.
 */

/** Bounds enforced by the schema in app/[patient]/check-in/actions.ts. */
const DOSE_MAX_MINUTES = 1440;
const SLEEP_DEBT_MAX_HOURS = 12;

function increases(presets: readonly Preset[]): boolean {
  return presets.every((preset, i) => i === 0 || preset.value > presets[i - 1].value);
}

describe('domain questions', () => {
  it('covers every load domain the check-in is responsible for collecting', () => {
    // Sleep is asked separately, because it is a shortfall rather than a dose.
    const collected = DOMAIN_QUESTIONS.map((question) => question.domain);
    const expected = LOAD_DOMAINS.filter((domain) => domain !== 'sleepFatigue');
    expect([...collected].sort()).toEqual([...expected].sort());
  });

  it('asks about each domain exactly once', () => {
    const domains = DOMAIN_QUESTIONS.map((question) => question.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it.each(DOMAIN_QUESTIONS)('$domain offers enough range to be meaningful', (question) => {
    expect(question.presets.length).toBeGreaterThanOrEqual(4);
  });

  it.each(DOMAIN_QUESTIONS)('$domain presets increase in order', (question) => {
    // The options are rendered top to bottom. One out of order reads as a
    // mistake and gets mis-tapped.
    expect(increases(question.presets), question.presets.map((p) => p.value).join(',')).toBe(true);
  });

  it.each(DOMAIN_QUESTIONS)('$domain presets stay inside what the server accepts', (question) => {
    for (const preset of question.presets) {
      expect(preset.value).toBeGreaterThanOrEqual(0);
      expect(preset.value, `${question.domain}: ${preset.label}`).toBeLessThanOrEqual(
        DOSE_MAX_MINUTES,
      );
    }
  });

  it.each(DOMAIN_QUESTIONS)('$domain labels are distinct', (question) => {
    const labels = question.presets.map((preset) => preset.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(DOMAIN_QUESTIONS)('$domain explains what it is asking about', (question) => {
    expect(question.question).toMatch(/\?$/);
    expect(question.help.length).toBeGreaterThan(20);
  });

  it('never offers a single option that exceeds a waking day', () => {
    for (const question of DOMAIN_QUESTIONS) {
      const largest = question.presets.at(-1)!.value;
      expect(largest, question.domain).toBeLessThanOrEqual(16 * 60);
    }
  });
});

describe('sleep presets', () => {
  it('start at no shortfall', () => {
    expect(SLEEP_PRESETS[0].value).toBe(0);
  });

  it('increase in order and stay inside what the server accepts', () => {
    expect(increases(SLEEP_PRESETS)).toBe(true);
    for (const preset of SLEEP_PRESETS) {
      expect(preset.value).toBeLessThanOrEqual(SLEEP_DEBT_MAX_HOURS);
    }
  });

  it('are worded as sleep, not as debt', () => {
    // "Two hours of sleep debt" is a modelling term. Nobody answers that at
    // seven in the morning with a headache.
    for (const preset of SLEEP_PRESETS) {
      expect(preset.label.toLowerCase()).not.toMatch(/debt|deficit/);
    }
  });
});

describe('duration presets', () => {
  it('increase in order and stay inside what the server accepts', () => {
    expect(increases(DURATION_PRESETS)).toBe(true);
    for (const preset of DURATION_PRESETS) {
      expect(preset.value).toBeLessThanOrEqual(DOSE_MAX_MINUTES);
    }
  });

  it('straddle the one-hour limit the guideline cares about', () => {
    // The question exists to decide whether a rise was "brief", which the
    // guideline defines as up to an hour. Options have to fall on both sides.
    expect(DURATION_PRESETS.some((preset) => preset.value <= 60)).toBe(true);
    expect(DURATION_PRESETS.some((preset) => preset.value > 60)).toBe(true);
  });
});
