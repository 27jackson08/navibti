import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOAD_DOMAIN_LABELS } from '@/data/guidelines';
import { DoseCard } from '@/components/plan/DoseCard';
import { Notice } from '@/components/plan/Notice';
import { StageCard } from '@/components/plan/StageCard';
import { getCheckIns, getPatient } from '@/db/store';
import { buildSession, deltaPointsOf, isoDay, settingFor } from '@/engine/session';
import { replayHistory } from '@/engine/history';
import { acknowledgementsFor, unavailableAccommodations } from '@/db/responses';
import { deriveSlots, fillSlots } from '@/engine/packet/slots';

// The demo store lives in memory, so these pages must never be prerendered
// at build time -- a static snapshot would show the seeded history forever.
export const dynamic = 'force-dynamic';

const PACKET_BLURB: Record<string, string> = {
  school: 'Class blocks, break cadence, screen caps and assessment limits.',
  employer: 'Meeting caps, phased hours, async-first working and deferred decisions.',
  caregiver: 'What helps, what does not, and the red flags to watch for.',
};

export default async function TodayPage({ params }: PageProps<'/[patient]/today'>) {
  const { patient: patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();

  const session = buildSession(patient, getCheckIns(patient.id), isoDay(new Date()), {
    unavailableSupports: unavailableAccommodations(patient.id),
  });
  const acknowledgements = acknowledgementsFor(patient.id);
  const yesterday = replayHistory(patient, getCheckIns(patient.id), {
    unavailableSupports: unavailableAccommodations(patient.id),
  }).at(-1);
  const latest = session.checkIns.at(-1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <nav className="flex items-baseline justify-between gap-4">
        <Link href="/" className="font-mono text-xs text-ink-faint hover:text-ink">
          ← All patients
        </Link>
        <span className="flex items-baseline gap-4">
          <Link
            href={`/${patient.id}/history`}
            className="font-mono text-xs text-accent underline-offset-4 hover:underline"
          >
            Progress →
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-faint">
            Day {session.daysSinceInjury}
          </span>
        </span>
      </nav>

      <h1 className="mt-6 text-[clamp(2rem,1.4rem+2.4vw,3rem)] leading-[1.06]">
        {session.hasCheckedInToday
          ? `Today’s plan for ${patient.displayName}`
          : `${patient.displayName} hasn’t checked in today`}
      </h1>

      {session.redFlag ? (
        <div className="mt-8">
          <Notice tone="critical" label="Stop — seek urgent care">
            <p className="text-base">{session.redFlag.instruction}</p>
            <p className="mt-3">
              No plan has been generated. NaviTBI does not produce guidance on a day when a
              red-flag symptom is reported.
            </p>
          </Notice>
        </div>
      ) : (
        <>
          {!session.hasCheckedInToday && (
            <p className="mt-4 max-w-[56ch] text-ink-soft">
              This plan is carried over from the last check-in
              {latest ? ` on ${latest.day}` : ''}. It takes about a minute to update it.
            </p>
          )}

          <div className="mt-6">
            <Link
              href={`/${patient.id}/check-in`}
              className="inline-flex items-center border border-accent px-5 py-3 font-medium text-accent hover:bg-accent hover:text-ground"
            >
              {session.hasCheckedInToday ? 'Redo today’s check-in' : 'Start today’s check-in'}
            </Link>
          </div>

          {session.escalations.length > 0 && (
            <div className="mt-8 flex flex-col gap-3">
              {session.escalations.map((message) => (
                <Notice key={message} tone="caution" label="Worth raising with a clinician">
                  {message}
                </Notice>
              ))}
            </div>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col gap-6">
              <StageCard
                stage={session.stage}
                decision={session.lastDecision}
                setting={settingFor(patient)}
              />
              {session.patient.protocol === 'return-to-sport' && (
                <>
                  <p className="max-w-[52ch] text-sm text-ink-soft">
                    The two ladders run in parallel. School governs how much thinking and screen
                    time is reasonable; sport governs physical progression — and step 4 of sport
                    cannot open until school is back to full time.
                  </p>
                  <StageCard stage={session.learnStage} decision={null} setting={settingFor(patient)} />
                </>
              )}
            </div>

            {session.attribution && latest && (
              <section className="border border-rule bg-surface p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                  Yesterday
                </p>
                <h2 className="mt-2 text-2xl">
                  {session.attribution.outcome === 'nothing-to-explain'
                    ? 'Symptoms stayed mild'
                    : `Symptoms rose ${deltaPointsOf(latest).toFixed(1)} points`}
                </h2>
                <p className="mt-3 leading-relaxed">{session.attribution.explanation}</p>

                {session.attribution.leading.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {session.attribution.leading.map((contribution) => (
                      <li key={contribution.domain} className="flex items-baseline gap-3 text-sm">
                        <span className="font-mono tabular-nums text-ink-faint">
                          {Math.round(contribution.share * 100)}%
                        </span>
                        <span>{LOAD_DOMAIN_LABELS[contribution.domain]}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-4 font-mono text-xs leading-relaxed text-ink-faint">
                  Patterns, not causes. NaviTBI reports what a day is most consistent with, and
                  says so when it cannot tell.
                </p>
              </section>
            )}
          </div>

          {(session.unmetSupports.length > 0 || acknowledgements.length > 0) && (
            <section className="mt-8 flex flex-col gap-3">
              {acknowledgements.length > 0 && (
                <Notice tone="steady" label="They have this">
                  <p>
                    {acknowledgements
                      .map((entry) => entry.role)
                      .join(' and ')}{' '}
                    confirmed receiving {patient.displayName}’s plan.
                  </p>
                </Notice>
              )}

              {session.unmetSupports.length > 0 && (
                <Notice tone="caution" label="Reported unavailable">
                  <p>
                    Some support {patient.displayName}’s plan assumed is not available, so today’s
                    limits have been lowered to stop counting on it.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {session.unmetSupports.map((item) => (
                      <li key={item.accommodationId}>
                        <span className="capitalize">{item.role}</span>:{' '}
                        {session.plan ? fillSlots(item.text, deriveSlots(session.plan)) : item.text}
                      </li>
                    ))}
                  </ul>
                </Notice>
              )}
            </section>
          )}

          {session.underExposure.length > 0 && (
            <div className="mt-6 flex flex-col gap-3">
              {session.underExposure.map((finding) => (
                <Notice key={finding.domain} tone="steady" label="There is room to do more">
                  <p>
                    <strong>{LOAD_DOMAIN_LABELS[finding.domain]}.</strong> {finding.message}
                  </p>
                </Notice>
              ))}
            </div>
          )}

          {yesterday?.adherence !== null &&
            yesterday !== undefined &&
            yesterday.adherence !== undefined &&
            yesterday.adherence > 1.25 && (
              <section className="mt-8">
                <Notice tone="neutral" label="About yesterday">
                  <p className="leading-relaxed">
                    Yesterday came in around{' '}
                    <strong>{Math.round((yesterday.adherence - 1) * 100)}% above the plan</strong>.{' '}
                    {yesterday.exceeded
                      ? `Symptoms then rose ${yesterday.deltaPoints.toFixed(1)} points and stayed up for ${yesterday.durationMinutes} minutes.`
                      : 'Symptoms stayed inside the mild range afterwards, which is useful to know.'}{' '}
                    Today’s limits already account for it.
                  </p>
                  <p className="mt-2 text-ink-soft">
                    This is information, not a telling-off. Days run away from everyone, and a log
                    that only records the good ones is worth nothing.
                  </p>
                </Notice>
              </section>
            )}

          {session.sensitivity.canDescribe && (
            <section className="mt-8">
              <Notice tone="neutral" label="What costs you most">
                <p className="text-base leading-relaxed">{session.sensitivity.summary}</p>
              </Notice>
            </section>
          )}

          {session.plan && (
            <section className="mt-10">
              <h2 className="border-t border-rule pt-5 text-xl">Today’s limits</h2>
              {session.plan.isProvisional && (
                <p className="mt-2 max-w-[60ch] text-sm text-ink-soft">
                  Provisional — there are not enough check-ins yet for these to be personal to
                  {` ${patient.displayName}`}. They are deliberately cautious until there are.
                </p>
              )}
              {session.plan.floorOverrodeModel && (
                <div className="mt-4">
                  <Notice tone="caution" label="Some limits were raised, not lowered">
                    <p>
                      For the domains marked <em>raised to the minimum</em>, {patient.displayName}’s
                      recent days suggest less — but resting below the guideline minimum is not
                      recommended either, and extended rest slows recovery in its own right. Keep
                      those gentle, and mention the mismatch at the next appointment.
                    </p>
                  </Notice>
                </div>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {session.plan.recommendations.map((recommendation) => (
                  <DoseCard key={recommendation.domain} recommendation={recommendation} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {!session.redFlag && session.plan && (
        <section className="mt-12">
          <h2 className="border-t border-rule pt-5 text-xl">Share with the people around them</h2>
          <p className="mt-2 max-w-[58ch] text-sm text-ink-soft">
            The same tolerance, written for whoever has to act on it. Each one is composed from a
            cited library — nothing here is generated prose.
          </p>
          <ul className="mt-5 grid gap-px border border-rule bg-rule sm:grid-cols-3">
            <li className="bg-ground">
              <Link
                href={`/${patient.id}/clinician`}
                className="flex h-full flex-col gap-2 p-5 hover:bg-surface focus-visible:bg-surface"
              >
                <span className="text-lg">Clinician</span>
                <span className="text-sm text-ink-soft">
                  Trajectory, adherence, current limits and what to ask about.
                </span>
                <span className="mt-auto pt-2 font-mono text-xs text-accent">Open summary →</span>
              </Link>
            </li>
            {patient.roles.map((role) => (
              <li key={role} className="bg-ground">
                <Link
                  href={`/${patient.id}/packet/${role}`}
                  className="flex h-full flex-col gap-2 p-5 hover:bg-surface focus-visible:bg-surface"
                >
                  <span className="text-lg capitalize">{role}</span>
                  <span className="text-sm text-ink-soft">{PACKET_BLURB[role]}</span>
                  <span className="mt-auto pt-2 font-mono text-xs text-accent">Open packet →</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4">
            <Link
              href={`/${patient.id}/sharing`}
              className="font-mono text-xs text-accent underline-offset-4 hover:underline"
            >
              Manage who can see these →
            </Link>
          </p>
        </section>
      )}

      <p className="mt-12 border-l-2 border-rule pl-4 font-mono text-xs leading-relaxed text-ink-faint">
        Not medical advice. Built on the Amsterdam 2023 consensus statement and the PedsConcussion
        living guideline. NaviTBI does not diagnose and does not issue clearance.
      </p>
    </main>
  );
}
