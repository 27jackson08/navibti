/** Reading level of everything that leaves the app. Run: npm run readability */
import { ACCOMMODATION_LIBRARY } from '@/data/accommodations';
import { RED_FLAGS, RED_FLAG_INSTRUCTION } from '@/data/guidelines';
import { DOMAIN_QUESTIONS, SLEEP_PRESETS } from '@/data/check-in-presets';
import { gradeLevel } from '@/lib/readability';

function report(name: string, texts: readonly { id: string; text: string }[]) {
  const scored = texts
    .map((entry) => ({ ...entry, grade: gradeLevel(entry.text) }))
    .sort((a, b) => b.grade - a.grade);
  const mean = scored.reduce((sum, entry) => sum + entry.grade, 0) / scored.length;

  console.log(`\n${name} — ${scored.length} items, mean grade ${mean.toFixed(1)}`);
  for (const entry of scored.slice(0, 4)) {
    console.log(`  ${entry.grade.toFixed(1).padStart(5)}  ${entry.id}`);
    console.log(`         "${entry.text.slice(0, 88)}${entry.text.length > 88 ? '…' : ''}"`);
  }
}

report(
  'Accommodation text',
  ACCOMMODATION_LIBRARY.map((item) => ({ id: item.id, text: item.text })),
);
report(
  'Accommodation rationales',
  ACCOMMODATION_LIBRARY.map((item) => ({ id: item.id, text: item.rationale })),
);
report('Red flags', [
  ...RED_FLAGS.map((flag) => ({ id: flag.id, text: flag.label })),
  { id: 'instruction', text: RED_FLAG_INSTRUCTION },
]);
report('Check-in', [
  ...DOMAIN_QUESTIONS.map((q) => ({ id: q.domain, text: `${q.question} ${q.help}` })),
  ...SLEEP_PRESETS.map((p) => ({ id: p.label, text: p.label })),
]);
