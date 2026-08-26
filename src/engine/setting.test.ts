import { describe, expect, it } from 'vitest';
import { getPatient } from '@/db/store';
import { settingFor } from './session';
import { schoolAbsenceWarning } from './stage/machine';

/**
 * The Return-to-Learn ladder is the right ladder for a working adult —
 * cognitive load is cognitive load — but its published wording is written for
 * students. A thirty-four-year-old knowledge worker was being shown a step
 * described in classrooms, partial school days and school environments, which
 * reads as a system that has not noticed who is using it.
 */

describe('who this patient is', () => {
  it.each([
    ['maya', 'school'],
    ['amara', 'school'],
    ['daniel', 'work'],
    ['tom', 'work'],
  ])('%s is in a %s setting', (id, expected) => {
    expect(settingFor(getPatient(id)!)).toBe(expected);
  });
});

describe('the absence warning speaks to the right audience', () => {
  it('says school to a student', () => {
    const warning = schoolAbsenceWarning(9, 'school');
    expect(warning).toMatch(/out of school/);
    expect(warning).not.toMatch(/away from work/);
  });

  it('says work to an adult, and marks the mapping as ours', () => {
    const warning = schoolAbsenceWarning(9, 'work');
    expect(warning).toMatch(/away from work/);
    // The guideline states this about school. Extending it to work is our
    // reasoning, and the copy says so rather than implying a citation.
    expect(warning).toMatch(/guidance is written about school/);
  });

  it('uses the same threshold either way', () => {
    expect(schoolAbsenceWarning(7, 'school')).toBeNull();
    expect(schoolAbsenceWarning(7, 'work')).toBeNull();
    expect(schoolAbsenceWarning(8, 'school')).not.toBeNull();
    expect(schoolAbsenceWarning(8, 'work')).not.toBeNull();
  });

  it('defaults to school, which is what the guideline actually says', () => {
    expect(schoolAbsenceWarning(9)).toMatch(/out of school/);
  });
});
