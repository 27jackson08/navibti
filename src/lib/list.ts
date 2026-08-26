/**
 * Joining a list into a sentence.
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
