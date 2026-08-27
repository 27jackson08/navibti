import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LOAD_DOMAIN_LABELS, PROTOCOLS, stepOf } from '@/data/guidelines';
import { HistoryChart } from '@/components/plan/HistoryChart';
import { Notice } from '@/components/plan/Notice';
import { unavailableAccommodations } from '@/db/responses';
import { getCheckIns, getPatient } from '@/db/store';
import { domainTrends, replayHistory } from '@/engine/history';
import { buildSession, isoDay, settingFor } from '@/engine/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Progress — NaviTBI' };

export default async function HistoryPage({ params }: PageProps<'/[patient]/history'>) {
  const { patient: patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();

  const options = { unavailableSupports: unavailableAccommodations(patient.id) };
  const checkIns = getCheckIns(patient.id);
  const history = replayHistory(patient, checkIns, options);
  const trends = domainTrends(history);
  const session = buildSession(patient, checkIns, isoDay(new Date()), options);

  const flareDays = history.filter((day) => day.exceeded && !day.redFlagged).length;
  const stageChanges = history.filter(
    (day, index) => index > 0 && day.learnStep !== history[index - 1].learnStep,
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
      <nav className="flex items-baseline justify-between gap-4">
        <Link href={`/${patient.id}/today`} className="font-mono text-xs text-ink-faint hover:text-ink">
          ← Back to today
        </Link>
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-faint">
          {history.length} check-ins
        </span>
      </nav>

      <h1 className="mt-6 text-[clamp(2rem,1.5rem+2.4vw,3rem)] leading-[1.06]">
        {patient.displayName}’s recovery so far
      </h1>

      {trends.length > 0 ? (
        <>
          <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-soft">
            Recovery is rarely a straight line, and the bad days are part of the shape rather than
            a setback in it. Here is what has changed.
          </p>
          <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-ink-soft">
            Some of these will have gone down. That usually means the model has learned something
            costs {patient.displayName} more than it first assumed, or that support the plan
            counted on was reported unavailable — not that recovery has reversed.
          </p>

          <ul className="mt-8 grid gap-px border border-rule bg-rule sm:grid-cols-2">
            {trends.map((trend) => (
              <li key={trend.domain} className="bg-ground p-4">
                <p className="text-sm">{LOAD_DOMAIN_LABELS[trend.domain]}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-2xl tabular-nums">
                    {Math.round(trend.first)}
                  </span>
                  <span className="text-ink-faint">→</span>
                  {/* Colour follows direction. Painting every change in the
                      accent implies all movement is progress, and half of it
                      may not be. */}
                  <span
                    className={`font-mono text-2xl tabular-nums ${
                      trend.improving ? 'text-accent' : 'text-ink'
                    }`}
                  >
                    {Math.round(trend.latest)}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-ink-faint">
                  {trend.improving
                    ? `up ${Math.round(trend.change)} since the estimates settled`
                    : `down ${Math.abs(Math.round(trend.change))} since the estimates settled`}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-soft">
          There are not enough check-ins yet to show a trend. The first couple of days are mostly
          the starting assumptions rather than anything personal to {patient.displayName}, so
          progress is measured from the point the estimates settle.
        </p>
      )}

      <section className="mt-12">
        <h2 className="border-t border-rule pt-5 text-xl">Day by day</h2>
        <p className="mt-2 max-w-[58ch] text-sm text-ink-soft">
          Each day shows what was recommended at the time — not what would be recommended now
          with hindsight.
        </p>
        <div className="mt-6">
          <HistoryChart history={history} />
        </div>
      </section>

      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="border border-rule bg-surface p-5">
          <h2 className="text-lg">Stage</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {settingFor(patient) === 'work' ? 'Returning to work' : 'Returning to school'}, now
            step {session.learnStage.step} —{' '}
            {stepOf(PROTOCOLS['return-to-learn'], session.learnStage.step).title}.
          </p>
          {stageChanges.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 font-mono text-xs text-ink-faint">
              {stageChanges.map((change) => (
                <li key={change.day}>
                  {change.day} — moved to step {change.learnStep}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-mono text-xs text-ink-faint">No stage changes yet.</p>
          )}
        </div>

        <div className="border border-rule bg-surface p-5">
          <h2 className="text-lg">Days over the limit</h2>
          <p className="mt-2 font-mono text-3xl tabular-nums">
            {flareDays}
            <span className="ml-2 text-sm text-ink-soft">of {history.length}</span>
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Days where symptoms rose more than two points, or stayed raised beyond an hour. Some
            of these are unavoidable, and the number falling over time matters more than any one
            of them.
          </p>
        </div>
      </section>

      {session.sensitivity.canDescribe && (
        <div className="mt-10">
          <Notice tone="neutral" label="What costs you most">
            <p className="text-base leading-relaxed">{session.sensitivity.summary}</p>
          </Notice>
        </div>
      )}

      <p className="mt-12 border-l-2 border-rule pl-4 font-mono text-xs leading-relaxed text-ink-faint">
        Not medical advice. These are NaviTBI’s own estimates replayed over time, not a clinical
        measure of recovery.
      </p>
    </main>
  );
}
