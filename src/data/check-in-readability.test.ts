import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_LIBRARY } from '@/data/accommodations';
import { DOMAIN_QUESTIONS } from '@/data/check-in-presets';
import { gradeLevel } from '@/lib/readability';

/**
 * Reading level, enforced rather than only reported.
 *
 * `npm run readability` has printed these numbers for a while and nothing acted
 * on them, so an edit could have pushed the check-in to the reading level of
 * the packets and no gate would have noticed. The audience is people with
 * concussion — reduced concentration and reading tolerance are symptoms, not
 * incidental — so this is a functional requirement in the same way contrast is.
 *
 * The thresholds are deliberately generous. This is a floor against drift, not
 * a definition of good writing, and Flesch-Kincaid is crude enough that a
 * tighter bound would fail on sentences that read perfectly well.
 *
 * Three things are exempt, for reasons worth stating rather than assuming:
 *
 *   red flags       verbatim CRT6 transcriptions. "Increasingly restless,
 *                   agitated, or combative" scores badly and must not be
 *                   reworded — the guideline layer is transcription, not
 *                   drafting, and paraphrasing it is exactly what the project
 *                   rules forbid.
 *   short strings   the metric is meaningless below a handful of words. It puts
 *                   "Poorly" at grade 8 and "Repeated vomiting" at 14.
 *   rationales      read by a school or HR administrator deciding whether to
 *                   grant something, not by the patient mid-symptom.
 */
const MIN_WORDS_TO_SCORE = 8;

describe('what the patient themselves has to read', () => {
  /**
   * The check-in is the one surface used daily by someone with active symptoms.
   * It is the strictest bound in the product for that reason.
   */
  const PATIENT_FACING_MAX_GRADE = 7;

  it.each(DOMAIN_QUESTIONS.map((question) => [question.domain, question] as const))(
    'asks about %s in plain language',
    (_domain, question) => {
      for (const text of [question.question, question.help ?? '']) {
        if (countableWords(text) < MIN_WORDS_TO_SCORE) continue;
        expect(gradeLevel(text), `"${text}"`).toBeLessThanOrEqual(PATIENT_FACING_MAX_GRADE);
      }
    },
  );
});

describe('what a school or workplace has to read', () => {
  /**
   * A packet is a document an administrator acts on, so a higher bound is
   * honest. It still has to be readable in one pass: a letter that has to be
   * read twice is a letter that gets filed unread, and the people worst
   * affected by that are the ones least able to chase it up.
   */
  const PACKET_MAX_GRADE = 14;

  const scorable = ACCOMMODATION_LIBRARY.filter(
    (item) => countableWords(item.text) >= MIN_WORDS_TO_SCORE,
  );

  it('has something to measure', () => {
    expect(scorable.length).toBeGreaterThan(20);
  });

  it.each(scorable.map((item) => [item.id, item.text] as const))(
    '%s reads in one pass',
    (_id, text) => {
      expect(gradeLevel(text), `"${text}"`).toBeLessThanOrEqual(PACKET_MAX_GRADE);
    },
  );

  it('stays well below that on average', () => {
    const mean =
      scorable.reduce((total, item) => total + gradeLevel(item.text), 0) / scorable.length;
    expect(mean).toBeLessThanOrEqual(10);
  });
});

/** Placeholders are not words the reader sees; they are filled before rendering. */
function countableWords(text: string): number {
  return text.replace(/\{\{\w+\}\}/g, '30').split(/\s+/).filter(Boolean).length;
}
