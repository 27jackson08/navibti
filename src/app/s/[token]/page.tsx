import { notFound } from 'next/navigation';
import { PROTOCOLS, stepOf } from '@/data/guidelines';
import type { AccommodationRole } from '@/data/accommodations';
import { ClinicianSummaryView } from '@/components/packet/ClinicianSummaryView';
import { ClinicianIntake } from '@/components/packet/ClinicianIntake';
import { buildSession as buildStageSession } from '@/engine/session';
import { PacketView } from '@/components/packet/PacketView';
import { PrintButton } from '@/components/packet/PrintButton';
import { recordAccess, resolveToken } from '@/db/share';
import {
  acknowledgementsFor,
  responsesForLink,
  unavailableAccommodations,
} from '@/db/responses';
import { ACCOMMODATION_LIBRARY } from '@/data/accommodations';
import type { FlaggedItem } from '@/components/packet/PacketView';
import { getCheckIns, getPatient } from '@/db/store';
import { clinicianSummary } from '@/engine/packet/clinician';
import { composePacket, diffPackets } from '@/engine/packet/compose';
import { buildSession, isoDay } from '@/engine/session';

export const dynamic = 'force-dynamic';

/**
 * The unauthenticated view. Everything a recipient sees is decided by the
 * token: which patient, which audience, and whether raw symptom scores travel
 * with it. There is no navigation out of here into the rest of the app.
 */
export default async function SharedPage({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params;

  // An unknown, expired or revoked token all reach the same 404, so a stale
  // link tells its holder nothing.
  const link = resolveToken(token);
  if (!link) notFound();

  const patient = getPatient(link.patientId);
  if (!patient) notFound();

  recordAccess(link.id);

  const today = isoDay(new Date());
  const checkIns = getCheckIns(patient.id);
  const unavailable = unavailableAccommodations(patient.id);

  if (link.role === 'clinician') {
    const stage = buildStageSession(patient, checkIns, today, {
      unavailableSupports: unavailable,
    });

    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <ClinicianSummaryView
          summary={clinicianSummary(patient, checkIns, today, { unavailableSupports: unavailable })}
          includeRawSymptoms={link.includesRawSymptoms}
        />

        {patient.protocol === 'return-to-sport' && (
          <div className="mt-10">
            <ClinicianIntake
              token={token}
              patientName={patient.displayName}
              currentSportStep={stage.stage.step}
              clearedUpTo={patient.clearance?.coversUpToStep ?? null}
              clearedBy={patient.clearance?.recordedBy ?? null}
            />
          </div>
        )}

        <div className="mx-auto mt-8 max-w-[68ch] print:hidden">
          <PrintButton label="Print or save this summary" />
        </div>
        <SharedFooter />
      </main>
    );
  }

  const session = buildSession(patient, checkIns, today, { unavailableSupports: unavailable });
  const packet = composePacket(session, link.role as AccommodationRole);
  if (!packet) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <div className="border-l-2 border-critical bg-critical-surface p-5">
          <h1 className="text-2xl">Nothing to show today</h1>
          <p className="mt-3 leading-relaxed">
            {patient.displayName} reported a symptom today that needs urgent medical attention
            rather than an accommodation plan. Please check in with them directly.
          </p>
        </div>
      </main>
    );
  }

  const previous =
    checkIns.length > 1
      ? composePacket(
          buildSession(patient, checkIns.slice(0, -1), checkIns.at(-2)!.day, {
            unavailableSupports: unavailable,
          }),
          link.role as AccommodationRole,
        )
      : null;

  // What this recipient has already told us, so they can see and undo it.
  const flagged: FlaggedItem[] = responsesForLink(link.id)
    .filter((entry) => entry.accommodationId !== null && entry.reason !== null)
    .map((entry) => ({
      id: entry.accommodationId!,
      reason: entry.reason!,
      text:
        ACCOMMODATION_LIBRARY.find((item) => item.id === entry.accommodationId)?.text ??
        entry.accommodationId!,
    }));

  const acknowledgedAt =
    acknowledgementsFor(patient.id).find((entry) => entry.linkId === link.id)?.at ?? null;

  const protocol = PROTOCOLS[session.learnStage.protocol];
  const stageLine =
    `${protocol.name}, step ${session.learnStage.step} of ${protocol.steps.length} — ` +
    `${stepOf(protocol, session.learnStage.step).title}. Day ${session.daysSinceInjury} since injury.`;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
      <PacketView
        packet={packet}
        diff={diffPackets(previous, packet)}
        stageLine={stageLine}
        respond={{ token, acknowledgedAt, flagged }}
      />
      <div className="mx-auto mt-8 max-w-[68ch] print:hidden">
        <PrintButton />
      </div>
      <SharedFooter />
    </main>
  );
}

function SharedFooter() {
  return (
    <p className="mx-auto mt-10 max-w-[68ch] border-t border-rule pt-5 font-mono text-xs leading-relaxed text-ink-faint print:hidden">
      Shared with you by the patient. This link can be revoked at any time, expires on its own,
      and records each time it is opened.
    </p>
  );
}
