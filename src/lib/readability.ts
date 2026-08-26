/**
 * Flesch-Kincaid grade level.
 *
 * Used on the text that leaves the app — accommodation packets, red-flag
 * instructions, the check-in itself. A letter a school administrator has to
 * read twice is a letter that gets filed unread, and the people most affected
 * by that are the ones with the least capacity to advocate for themselves.
 *
 * It is a crude measure. It counts syllables and sentence length and knows
 * nothing about whether a sentence is clear. It is used here as a floor against
 * drift, not as a definition of good writing.
 */

const VOWEL_GROUPS = /[aeiouy]+/g;
const WORDS = /[A-Za-z][A-Za-z'’-]*/g;

/**
 * Syllable estimate. Heuristic, and wrong on individual words often enough that
 * only the aggregate means anything.
 */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;

  const trimmed = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (trimmed.match(VOWEL_GROUPS) ?? []).length);
}

export function countWords(text: string): number {
  return (text.match(WORDS) ?? []).length;
}

export function countSentences(text: string): number {
  const parts = text.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim().length > 0);
  return Math.max(1, parts.length);
}

/** Grade level. Roughly the US school year needed to read it comfortably. */
export function gradeLevel(text: string): number {
  const words = text.match(WORDS) ?? [];
  if (words.length === 0) return 0;

  const sentences = countSentences(text);
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);

  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}
