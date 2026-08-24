/** Prints the packets each demo persona would receive. Run: npm run packets */
import { getCheckIns, listPatients } from '@/db/store';
import { buildSession, isoDay } from '@/engine/session';
import { composePacket } from '@/engine/packet/compose';

for (const patient of listPatients()) {
  const session = buildSession(patient, getCheckIns(patient.id), isoDay(new Date()));
  console.log(
    `\n${'='.repeat(70)}\n${patient.displayName} — day ${session.daysSinceInjury}, ` +
      `learn step ${session.learnStage.step}, ${patient.protocol} step ${session.stage.step}`,
  );
  for (const role of patient.roles) {
    const packet = composePacket(session, role);
    if (!packet) continue;
    console.log(`\n  ── ${packet.title} (${packet.items.length} items)`);
    for (const item of packet.items.slice(0, 4)) console.log(`     • ${item.text}`);
    if (packet.items.length > 4) console.log(`     … ${packet.items.length - 4} more`);
  }
}
