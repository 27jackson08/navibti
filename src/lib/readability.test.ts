import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_LIBRARY } from '@/data/accommodations';
import { DOMAIN_QUESTIONS } from '@/data/check-in-presets';
import { countSentences, countSyllables, countWords, gradeLevel } from './readability';

/**
 * Reading level of the text that leaves the app.
 *
 * Only applied to passages long enough for the measure to mean anything.
 * Flesch-Kincaid on "Repeated vomiting" returns grade 14.7 — two polysyllabic
 * words counted as a whole sentence — which says something about the formula
 * rather than about the phrase.
 */

const MEASURABLE_WORDS = 12;

const measurable = (text: string) => countWords(text) >= MEASURABLE_WORDS;
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('the measure itself', () => {
  it('counts syllables about right', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('breaks')).toBe(1);
    expect(countSyllables('concussion')).toBe(3);
    expect(countSyllables('accommodation')).toBe(5);
  });

  it('counts sentences without being fooled by a trailing stop', () => {
    expect(countSentences('One. Two. Three.')).toBe(3);
    expect(countSentences('No trailing stop')).toBe(1);
  });

  it('scores plain writing lower than dense writing', () => {
    const plain = 'Give the student a break after every class. Keep the room quiet and dim.';
    const dense =
      'Notwithstanding the aforementioned considerations, implementation of accommodations ' +
      'necessitates institutional coordination.';
    expect(gradeLevel(plain)).toBeLessThan(gradeLevel(dense));
  });

  it('returns zero for empty text rather than a NaN', () => {
    expect(gradeLevel('')).toBe(0);
  });
});

describe('what a school or employer actually reads', () => {
  const instructions = ACCOMMODATION_LIBRARY.map((item) => item.text).filter(measurable);
  const rationales = ACCOMMODATION_LIBRARY.map((item) => item.rationale).filter(measurable);

  it('keeps the instructions around grade nine on average', () => {
    expect(mean(instructions.map(gradeLevel))).toBeLessThanOrEqual(9);
  });

  it('keeps the reasoning around grade nine on average', () => {
    expect(mean(rationales.map(gradeLevel))).toBeLessThanOrEqual(9);
  });

  it.each(ACCOMMODATION_LIBRARY.filter((item) => measurable(item.text)))(
    '$id is not impenetrable',
    (item) => {
      // A generous individual ceiling. The mean is what is being defended; this
      // catches a single sentence that has run away from itself.
      expect(gradeLevel(item.text)).toBeLessThan(14);
    },
  );

  it.each(ACCOMMODATION_LIBRARY.filter((item) => measurable(item.rationale)))(
    '$id explains itself readably',
    (item) => {
      expect(gradeLevel(item.rationale)).toBeLessThan(14);
    },
  );
});

describe('what a patient reads while symptomatic', () => {
  it('asks its questions very plainly', () => {
    // The check-in is read by someone with a headache and light sensitivity.
    // It has a tighter budget than a letter a school reads at a desk.
    const questions = DOMAIN_QUESTIONS.map((q) => `${q.question} ${q.help}`);
    expect(mean(questions.map(gradeLevel))).toBeLessThanOrEqual(7);
  });
});
