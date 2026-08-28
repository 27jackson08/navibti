import { describe, expect, it } from 'vitest';
import { indefiniteArticle, joinWords } from './list';

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

describe('choosing "a" or "an"', () => {
  it.each([
    ['cognitive', 'a'],
    ['vestibular', 'a'],
    ['sleep disturbance', 'a'],
    ['headache/migraine', 'a'],
    ['cervical strain', 'a'],
    // The two that were wrong on screen.
    ['ocular-motor', 'an'],
    ['ocular-motor or vestibular', 'an'],
    ['anxiety/mood', 'an'],
  ] as const)('says "%s" takes "%s"', (word, expected) => {
    expect(indefiniteArticle(word)).toBe(expected);
  });

  it.each([
    // Sound, not spelling. No regex over letters gets these right.
    ['hour', 'an'],
    ['honest assessment', 'an'],
    ['unilateral deficit', 'a'],
    ['use of screens', 'a'],
    ['university', 'a'],
    ['one-sided weakness', 'a'],
  ] as const)('handles "%s", which spelling alone would get wrong', (word, expected) => {
    expect(indefiniteArticle(word)).toBe(expected);
  });

  it('does not produce a stray article for nothing', () => {
    expect(indefiniteArticle('')).toBe('a');
    expect(indefiniteArticle('   ')).toBe('a');
  });
});
