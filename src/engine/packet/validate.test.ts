import { describe, expect, it } from 'vitest';
import { getCheckIns, getPatient, seededOn } from '@/db/store';
import { buildSession } from '@/engine/session';
import { composePacket } from './compose';
import { validateRewrite } from './validate';

/**
 * Adversarial tests for the rewrite guard, written by trying to defeat it.
 *
 * The first version of this validator was described in the project README as
 * making it impossible for a language model to invent a clinical claim. It was
 * not. Four attacks got straight through — a recovery claim, a fabricated
 * clinician endorsement, an appended instruction, and a flat statement that no
 * restrictions were necessary — all by appending a sentence.
 *
 * Reproduce the probe with `npm run attack`.
 */

const packet = composePacket(
  buildSession(getPatient('daniel')!, getCheckIns('daniel'), seededOn),
  'employer',
)!;

const capped = packet.items.find((item) => /^Cap /.test(item.text))!;
const phased = packet.items.find((item) => /\d/.test(item.text))!;

describe('attacks the validator blocks', () => {
  it.each([
    ['a recovery claim', `${phased.text} He has recovered.`],
    ['a fabricated clinician endorsement', `${phased.text} His doctor confirmed this is enough.`],
    ['declaring support unnecessary', `${phased.text} No restrictions are necessary.`],
    ['an appended instruction', `${phased.text} Also stop taking breaks.`],
    ['spelling a figure out to lose it', 'Cap live meetings at one per day and twenty minutes each.'],
    ['an invented figure', `${phased.text.replace('weekly.', 'weekly, plus 3 rest days.')}`],
    ['inverting with a negation', capped.text.replace(/^Cap /, 'Do not cap ')],
    ['dropping the subject entirely', 'Take it easy for a while.'],
    // Softening used to be in the list below, as a hole we could only document.
    // It is the one a tone pass is most likely to fall into, since making text
    // friendlier is the whole reason to add one — and unlike inversion it is
    // lexical, so it can be caught. Several phrasings, so the check is not just
    // matching the one string our attack script happened to use.
    ['softening with "where convenient"', `Where convenient, ${phased.text.toLowerCase()}`],
    ['softening with "consider"', phased.text.replace('Phase', 'Consider phasing')],
    ['softening with "if possible"', `If possible, ${phased.text.toLowerCase()}`],
    ['softening with "ideally"', `Ideally, ${phased.text.toLowerCase()}`],
    ['softening with "try to"', phased.text.replace('Phase', 'Try to phase')],
    ['softening into a suggestion', phased.text.replace('Phase', 'We suggest phasing')],
    ['softening with "feel free to"', phased.text.replace('Phase', 'Feel free to phase')],
    ['making it optional outright', `${phased.text.replace(/\.$/, '')} (optional).`],
  ])('blocks %s', (_name, rewrite) => {
    expect(validateRewrite(_name === 'spelling a figure out to lose it' ? capped : phased, rewrite))
      .not.toHaveLength(0);
  });

  it('still accepts an honest rephrasing', () => {
    const gentle = phased.text.replace('Phase hours back in:', 'Please phase hours back in:');
    expect(validateRewrite(phased, gentle)).toEqual([]);
  });
});

/**
 * Known limits, asserted so they are visible rather than forgotten.
 *
 * If one of these starts failing, the validator got stronger — that is a good
 * failure. Update the test and move the case up into the blocked list. That has
 * now happened once: softening a limit into a suggestion lived here until the
 * attack script found it, and it is in the blocked list above.
 *
 * What is left is one hole, in two costumes: replacing the operator with its
 * opposite. Every number, every subject word and the sentence count survive,
 * and no amount of pattern-adding reaches it — it needs meaning.
 */
describe('attacks the validator cannot block, and does not claim to', () => {
  it('cannot see an instruction reversed without a negation', () => {
    // Every number, every subject word and the sentence count survive. Only the
    // meaning changed, and a lexical validator has no access to meaning.
    const inverted = capped.text.replace(/^Cap /, 'Require at least ');
    expect(validateRewrite(capped, inverted)).toEqual([]);
  });

  it.each(['Set a minimum of ', 'Aim for at least ', 'Schedule at least ', 'Hold at least '])(
    'cannot see the inversion done as "%s" either',
    (verb) => {
      // Not one unlucky phrasing — the shape. Swap the operator for its
      // opposite and every countable thing survives. "Guarantee a minimum of"
      // is caught, but only by accident: "guarantee" is forbidden language for
      // an unrelated reason.
      expect(validateRewrite(capped, capped.text.replace(/^Cap /, verb))).toEqual([]);
    },
  );

  it('is therefore not the guarantee — the guarantee is that nothing rewrites', () => {
    // Packets are composed by selection from the cited library. No language
    // model writes packet text, so nothing currently reaches this validator at
    // all; it exists so that adding a tone pass later is a bounded change.
    for (const item of packet.items) {
      expect(item.text.length).toBeGreaterThan(0);
    }
  });
});
