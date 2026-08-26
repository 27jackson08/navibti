import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PROTOCOLS, stepOf } from '@/data/guidelines';
import type { AccommodationRole } from '@/data/accommodations';
import { PacketView } from '@/components/packet/PacketView';
import { PrintButton } from '@/components/packet/PrintButton';
import { getCheckIns, getPatient } from '@/db/store';
import { composePacket, diffPackets } from '@/engine/packet/compose';
import { buildSession, isoDay, settingFor } from '@/engine/session';
import { unavailableAccommodations } from '@/db/responses';

export const dynamic = 'force-dynamic';

const ROLES: readonly AccommodationRole[] = ['school', 'employer', 'caregiver'];

export default async function PacketPage({ params }: PageProps<'/[patient]/packet/[role]'>) {
  const { patient: patientId, role } = await params;
  const patient = getPatient(patientId);
  // Not just "is this a real role" but "is it one this patient has". Without
  // the second check a crafted URL produces a workplace accommodations letter
  // for a nine-year-old.
  if (!patient || !ROLES.includes(role as AccommodationRole)) notFound();
  if (!patient.roles.includes(role as AccommodationRole)) notFound();

  const today = isoDay(new Date());
  const checkIns = getCheckIns(patient.id);
  const unavailable = unavailableAccommodations(patient.id);
  const session = buildSession(patient, checkIns, today, { unavailableSupports: unavailable });
  const packet = composePacket(session, role as AccommodationRole);

  if (!packet) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <Link href={`/${patient.id}/today`} className="font-mono text-xs text-ink-faint">
          ← Back to today
        </Link>
        <div className="mt-8 border-l-2 border-critical bg-critical-surface p-5">
          <h1 className="text-2xl">No packet today</h1>
          <p className="mt-3 leading-relaxed">
            A red-flag symptom was reported. NaviTBI does not issue accommodations on a day when
            urgent medical care is the right next step.
          </p>
        </div>
      </main>
    );
  }

  // Yesterday's packet, so the recipient can see what moved rather than
  // re-reading the whole document.
  const previous =
    checkIns.length > 1
      ? composePacket(
          buildSession(patient, checkIns.slice(0, -1), checkIns.at(-2)!.day, {
            unavailableSupports: unavailable,
          }),
          role as AccommodationRole,
        )
      : null;

  const protocol = PROTOCOLS[session.learnStage.protocol];
  const ladder = settingFor(patient) === 'work' ? 'Returning to work' : 'Returning to school';
  const stageLine =
    `${ladder}, step ${session.learnStage.step} of ${protocol.steps.length} — ` +
    `${stepOf(protocol, session.learnStage.step).title}. Day ${session.daysSinceInjury} since injury.`;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
      <nav className="flex flex-wrap items-baseline justify-between gap-4 print:hidden">
        <Link href={`/${patient.id}/today`} className="font-mono text-xs text-ink-faint hover:text-ink">
          ← Back to today
        </Link>
        <div className="flex items-center gap-3 font-mono text-xs">
          <PrintButton />
          {patient.roles.map((available) => (
            <Link
              key={available}
              href={`/${patient.id}/packet/${available}`}
              className={available === role ? 'text-accent' : 'text-ink-faint hover:text-ink'}
            >
              {available}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mt-10">
        <PacketView packet={packet} diff={diffPackets(previous, packet)} stageLine={stageLine} />
      </div>
    </main>
  );
}
