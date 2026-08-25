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
 * failure. Update the test and move the case up into the blocked list.
 */
describe('attacks the validator cannot block, and does not claim to', () => {
  it('cannot see an instruction reversed without a negation', () => {
    // Every number, every subject word and the sentence count survive. Only the
    // meaning changed, and a lexical validator has no access to meaning.
    const inverted = capped.text.replace(/^Cap /, 'Require at least ');
    expect(validateRewrite(capped, inverted)).toEqual([]);
  });

  it('cannot see a requirement softened into a suggestion', () => {
    const softened = capped.text.replace(/^Cap /, 'Where convenient, consider capping ');
    expect(validateRewrite(capped, softened)).toEqual([]);
  });

  it('is therefore not the guarantee — the guarantee is that nothing rewrites', () => {
    // Packets are composed by selection from the cited library. No language
    // model writes packet text, so nothing currently reaches this validator at
    // all; it exists so that adding a tone pass later is a bounded change.
    for (const item of packet.items) {
      expect(item.text.length).toBeGreaterThan(0);
    }
  });
});
