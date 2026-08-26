import { describe, expect, it } from 'vitest';
import { joinWords } from './list';

describe('joining a list into a sentence', () => {
  it.each([
    [[], ''],
    [['school'], 'school'],
    [['school', 'caregiver'], 'school and caregiver'],
    [['school', 'caregiver', 'clinician'], 'school, caregiver and clinician'],
  ] as const)('renders %j as "%s"', (input, expected) => {
    expect(joinWords([...input], 'and')).toBe(expected);
  });

  it('does not repeat a role that answered on two links', () => {
    // The bug: links expire and get reissued, so one school can acknowledge
    // three times and the plan page said "school and school and school".
    expect(joinWords(['school', 'school', 'caregiver'], 'and')).toBe('school and caregiver');
  });

  it('drops empty entries rather than rendering a gap', () => {
    expect(joinWords(['school', '', 'caregiver'], 'and')).toBe('school and caregiver');
  });

  it('takes "or" for alternatives', () => {
    expect(joinWords(['vestibular', 'ocular-motor'], 'or')).toBe('vestibular or ocular-motor');
  });
});
