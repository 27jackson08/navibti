/** Adversarial probe of the packet rewrite validator. */
import { getCheckIns, getPatient, seededOn } from '@/db/store';
import { buildSession } from '@/engine/session';
import { composePacket } from '@/engine/packet/compose';
import { validateRewrite } from '@/engine/packet/validate';

const session = buildSession(getPatient('daniel')!, getCheckIns('daniel'), seededOn);
const packet = composePacket(session, 'employer')!;
const item = packet.items.find((i) => /^Cap /.test(i.text))!;

console.log('SOURCE:', item.text, '\n');

const attacks: [string, string][] = [
  ['negate the instruction',      item.text.replace(/^Cap/, 'Do not cap')],
  ['clearance, no banned word',   `${item.text} Daniel is fine to return to normal duties.`],
  ['recovery claim',              `${item.text} He has recovered.`],
  ['authority claim',             `${item.text} His doctor confirmed this is enough.`],
  ['soften into optional',        item.text.replace('Cap', 'Where convenient, consider capping')],
  ['append a new instruction',    `${item.text} Also stop taking breaks.`],
  ['numbers as words',            'Cap live meetings at one per day and twenty minutes each.'],
  ['reverse the limit',           item.text.replace('Cap', 'Require at least')],
  ['no restrictions needed',      `${item.text} No restrictions are necessary.`],
  ['invert: cap -> require',      item.text.replace(/^Cap /, 'Require at least ')],
  ['invert: add a negation',      item.text.replace(/^Cap /, 'Do not cap ')],
  ['invert: swap the operator',   item.text.replace('at most', 'at least').replace(/^Cap /, 'Hold at no fewer than ')],
];

for (const [name, rewrite] of attacks) {
  const violations = validateRewrite(item, rewrite);
  const verdict = violations.length ? `BLOCKED (${violations[0].kind})` : '*** PASSED ***';
  console.log(`${verdict.padEnd(26)} ${name}`);
  if (!violations.length) console.log(`${' '.repeat(26)} -> "${rewrite}"`);
}
