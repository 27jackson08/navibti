/**
 * Turning values into prose.
 *
 * Small, but it was being written by hand at each call site and one of them
 * produced "school and school and caregiver confirmed receiving Maya's plan" —
 * a document a school reads, ungrammatical and double-counting, because links
 * expire and get reissued and each reissue acknowledged separately.
 */
export function joinWords(items: readonly string[], conjunction: 'and' | 'or'): string {
  const unique = [...new Set(items.filter((item) => item.length > 0))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(', ')} ${conjunction} ${unique.at(-1)}`;
}

/**
 * "a" or "an" for a word about to follow.
 *
 * The subtype labels are interpolated straight into a sentence a patient reads —
 * "often described as a ocular-motor presentation", "a anxiety/mood
 * presentation" — which is a small error in a document whose whole job is to be
 * trusted enough to take to an appointment.
 *
 * Decided by sound rather than spelling, which is why the two awkward classes
 * are listed rather than inferred: a leading "u" that sounds like "you" takes
 * "a" ("a unilateral deficit"), and a silent "h" takes "an" ("an hour").
 * English has no rule here that a regex can apply, so this handles the closed
 * set of words the product actually uses and the test enumerates them.
 */
const SOUNDS_LIKE_CONSONANT = /^(?:u(?:ni|se|ti|su)|eu|one)/i;
const SILENT_H = /^(?:hour|honest|honou?r|heir)/i;

export function indefiniteArticle(following: string): 'a' | 'an' {
  const word = following.trim().toLowerCase();
  if (word.length === 0) return 'a';
  if (SILENT_H.test(word)) return 'an';
  if (SOUNDS_LIKE_CONSONANT.test(word)) return 'a';
  return /^[aeio]/.test(word) ? 'an' : 'a';
}
