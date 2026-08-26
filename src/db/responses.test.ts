import { describe, expect, it } from 'vitest';
import {
  acknowledge,
  acknowledgementsFor,
  clearFlag,
  flagAccommodation,
  isUnmet,
  responsesForLink,
  unavailableAccommodations,
  withdrawFlag,
} from './responses';

/**
 * The response store is a module-level singleton, so every test uses ids of its
 * own rather than resetting shared state a neighbouring test may be mid-way
 * through reading.
 */
let counter = 0;
const fresh = () => `t${++counter}`;

describe('what a recipient sends back', () => {
  it('records one standing answer per accommodation, not a stack of opinions', () => {
    const [patient, link] = [fresh(), fresh()];
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'no-space-available');
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'needs-approval');

    const entries = responsesForLink(link);
    expect(entries).toHaveLength(1);
    expect(entries[0].reason).toBe('needs-approval');
  });

  it('separates "we cannot" from "already handled"', () => {
    const [patient, link] = [fresh(), fresh()];
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'already-in-place');
    expect(isUnmet('already-in-place')).toBe(false);
    expect(unavailableAccommodations(patient).size).toBe(0);
  });

  it('keeps acknowledgements apart from item-level reports', () => {
    const [patient, link] = [fresh(), fresh()];
    acknowledge(patient, link, 'employer');
    flagAccommodation(patient, link, 'employer', 'work-meeting-cap', 'not-enough-staff');

    expect(acknowledgementsFor(patient)).toHaveLength(1);
    expect(unavailableAccommodations(patient)).toEqual(new Set(['work-meeting-cap']));
  });
});

describe('withdrawing a report after the link is gone', () => {
  /**
   * The recipient's own undo goes through their token, so it stops working the
   * day the link expires — and links expire in days while a school term runs
   * for months. Without a second way to withdraw, a September "we have no quiet
   * room" holds the plan down in June.
   */
  it('lets the patient withdraw a report their recipient can no longer reach', () => {
    const [patient, link] = [fresh(), fresh()];
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'no-space-available');
    expect(unavailableAccommodations(patient).has('school-quiet-space')).toBe(true);

    // The link is now expired or revoked; clearFlag is unreachable to them.
    expect(withdrawFlag(patient, 'school-quiet-space')).toBe(true);
    expect(unavailableAccommodations(patient).has('school-quiet-space')).toBe(false);
  });

  it('touches nobody else’s record', () => {
    const [mine, theirs, link] = [fresh(), fresh(), fresh()];
    flagAccommodation(mine, link, 'school', 'school-rest-period', 'needs-approval');
    flagAccommodation(theirs, fresh(), 'school', 'school-rest-period', 'needs-approval');

    withdrawFlag(mine, 'school-rest-period');
    expect(unavailableAccommodations(mine).size).toBe(0);
    expect(unavailableAccommodations(theirs).has('school-rest-period')).toBe(true);
  });

  it('reports honestly when there was nothing to withdraw', () => {
    expect(withdrawFlag(fresh(), 'school-quiet-space')).toBe(false);
  });

  it('leaves the accommodation flaggable again afterwards', () => {
    const [patient, link] = [fresh(), fresh()];
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'no-space-available');
    withdrawFlag(patient, 'school-quiet-space');
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'no-space-available');

    expect(unavailableAccommodations(patient).has('school-quiet-space')).toBe(true);
    expect(responsesForLink(link)).toHaveLength(1);
  });

  it('does not disturb an acknowledgement from the same link', () => {
    const [patient, link] = [fresh(), fresh()];
    acknowledge(patient, link, 'school');
    flagAccommodation(patient, link, 'school', 'school-quiet-space', 'no-space-available');

    withdrawFlag(patient, 'school-quiet-space');
    expect(acknowledgementsFor(patient)).toHaveLength(1);
  });

  it('agrees with the recipient’s own undo', () => {
    const [a, b, linkA, linkB] = [fresh(), fresh(), fresh(), fresh()];
    flagAccommodation(a, linkA, 'school', 'school-quiet-space', 'no-space-available');
    flagAccommodation(b, linkB, 'school', 'school-quiet-space', 'no-space-available');

    clearFlag(linkA, 'school-quiet-space');
    withdrawFlag(b, 'school-quiet-space');

    expect(unavailableAccommodations(a).size).toBe(0);
    expect(unavailableAccommodations(b).size).toBe(0);
  });
});
