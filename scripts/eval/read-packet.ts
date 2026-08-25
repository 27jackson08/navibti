/** Prints one packet in full, as the recipient receives it. */
import { getCheckIns, getPatient } from '@/db/store';
import { buildSession, isoDay } from '@/engine/session';
import { composePacket } from '@/engine/packet/compose';
import type { AccommodationRole } from '@/data/accommodations';

const id = process.argv[2] ?? 'maya';
const role = (process.argv[3] ?? 'school') as AccommodationRole;
const patient = getPatient(id)!;
const packet = composePacket(buildSession(patient, getCheckIns(id), isoDay(new Date())), role)!;

console.log(`${packet.title} for ${packet.patientName}\n${packet.generatedOn}\n`);
console.log(packet.intro, '\n');
packet.items.forEach((item, i) =>
  console.log(`${String(i + 1).padStart(2, '0')}. ${item.text}\n    (${item.rationale})\n`),
);
