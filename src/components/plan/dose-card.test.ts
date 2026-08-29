import { describe, expect, it } from 'vitest';
import { LOAD_DOMAINS } from '@/data/guidelines';
import { REFERENCE_DOSES } from '@/engine/tolerance/units';
import { formatDose, unitFor } from './DoseCard';

/**
 * How the daily plan's central figure reads.
 *
 * The zero case was already handled — "0 minutes" reads as a prohibition nobody
 * can meet — and one is its neighbour, reachable the same way: a clinician
 * ceiling, or a floor that lands there. It rendered "1 focused minutes" in the
 * primary card of the plan.
 */
describe('the number and its unit', () => {
  it.each(LOAD_DOMAINS)('%s reads correctly at a dose of one', (domain) => {
    const { unit } = REFERENCE_DOSES[domain];
    const rendered = `${formatDose(1, unit)} ${unitFor(1, unit)}`;

    expect(rendered, rendered).not.toMatch(/\b1 \w+(-\w+)? minutes\b/);
    expect(rendered, rendered).not.toMatch(/\b1 hours\b/);
  });

  it.each(LOAD_DOMAINS)('%s stays plural above one', (domain) => {
    const { unit } = REFERENCE_DOSES[domain];
    expect(unitFor(2, unit)).toBe(unit);
    expect(unitFor(45, unit)).toBe(unit);
  });

  it('leaves sleep debt alone, because it is printed to one decimal', () => {
    const { unit } = REFERENCE_DOSES.sleepFatigue;
    expect(formatDose(1, unit)).toBe('1.0');
    expect(unitFor(1, unit)).toBe(unit);
  });

  it('rounds before deciding, so 1.4 is singular and 1.6 is not', () => {
    const { unit } = REFERENCE_DOSES.cognitive;
    expect(unitFor(1.4, unit)).toBe('focused minute');
    expect(unitFor(1.6, unit)).toBe(unit);
  });
});
