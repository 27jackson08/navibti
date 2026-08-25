import { LOAD_DOMAIN_LABELS } from '@/data/guidelines';
import type { ClinicianSummary } from '@/engine/packet/clinician';

type Props = {
  summary: ClinicianSummary;
  /** Raw daily scores are withheld unless the patient shared them. */
  includeRawSymptoms: boolean;
};

const BINDING_LABEL: Record<string, string> = {
  model: 'this patient’s data',
  ramp: 'gradual progression',
  stage: 'stage ceiling',
  floor: 'guideline minimum',
};

export function ClinicianSummaryView({ summary, includeRawSymptoms }: Props) {
  return (
    <article className="flex flex-col gap-8">
      <header className="border-b border-rule pb-5">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-accent">
          Clinician summary · {summary.generatedOn}
        </p>
        <h1 className="mt-3 text-[clamp(1.8rem,1.4rem+1.8vw,2.5rem)] leading-[1.1]">
          {summary.patientName}
        </h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Fact label="Injury" value={summary.injuryDate} />
          <Fact label="Day" value={String(summary.daysSinceInjury)} />
          <Fact label="Return to learn" value={`Step ${summary.learn.step} of ${summary.learn.total}`} />
          {summary.sport && (
            <Fact label="Return to sport" value={`Step ${summary.sport.step} of ${summary.sport.total}`} />
          )}
        </dl>
      </header>

      {summary.escalations.length > 0 && (
        <section className="border-l-2 border-caution bg-caution-surface p-4">
          <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">
            Flagged
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {summary.escalations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xl">Symptom trajectory</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Peak daily severity on the 0–10 scale. Marked days breached the mild-and-brief limit —
          more than a 2-point rise over pre-activity, or lasting beyond an hour.
        </p>
        <Trajectory summary={summary} />

        {includeRawSymptoms ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-faint text-left font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-faint">
                  <th className="py-2 pr-4">Day</th>
                  <th className="py-2 pr-4">Pre-activity</th>
                  <th className="py-2 pr-4">Peak</th>
                  <th className="py-2 pr-4">Rise</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Within limit</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {summary.trajectory.map((point) => (
                  <tr key={point.day} className="border-b border-rule">
                    <td className="py-1.5 pr-4">{point.day}</td>
                    <td className="py-1.5 pr-4">{point.preActivitySeverity.toFixed(1)}</td>
                    <td className="py-1.5 pr-4">{point.worstSeverity.toFixed(1)}</td>
                    <td className="py-1.5 pr-4">{point.deltaPoints.toFixed(1)}</td>
                    <td className="py-1.5 pr-4">{point.durationMinutes}m</td>
                    <td className="py-1.5">
                      {point.redFlagged ? 'red flag' : point.exceeded ? 'no' : 'yes'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 border-l-2 border-rule pl-4 text-sm text-ink-soft">
            Day-by-day scores were not included in this share. The patient chose to share trends
            and current limits without the underlying symptom log.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl">Current limits</h2>
        <ul className="mt-4 grid gap-px border border-rule bg-rule sm:grid-cols-2">
          {summary.currentTolerance.map((line) => (
            <li key={line.domain} className="flex items-baseline justify-between gap-4 bg-ground p-4">
              <span className="text-sm">{LOAD_DOMAIN_LABELS[line.domain]}</span>
              <span className="text-right">
                <span className="font-mono tabular-nums">
                  {line.unit.includes('sleep') ? line.dose.toFixed(1) : Math.round(line.dose)}
                </span>
                <span className="ml-1 text-xs text-ink-soft">{line.unit}</span>
                <span className="block font-mono text-[0.66rem] text-ink-faint">
                  set by {BINDING_LABEL[line.binding] ?? line.binding}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-xs text-ink-faint">
          Based on {summary.observations} check-ins
          {summary.isPersonalized ? '' : ' — not yet personalised, estimates are close to prior'}.
        </p>
      </section>

      <section>
        <h2 className="text-xl">Adherence</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Logged load as a proportion of what was recommended on that day, averaged across domains.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {summary.adherence.map((point) => (
            <li
              key={point.day}
              title={`${point.day}: ${Math.round(point.ratio * 100)}% of plan`}
              className={`border px-2.5 py-1 font-mono text-xs tabular-nums ${
                point.overshot ? 'border-caution text-caution' : 'border-rule text-ink-soft'
              }`}
            >
              {Math.round(point.ratio * 100)}%
            </li>
          ))}
        </ul>
      </section>

      {summary.openQuestions.length > 0 && (
        <section>
          <h2 className="text-xl">Worth asking about</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
            {summary.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-rule pt-5">
        <p className="border-l-2 border-caution bg-caution-surface p-4 text-sm leading-relaxed">
          <strong className="font-semibold">Not a clinical decision tool.</strong> NaviTBI
          organises self-reported data alongside published guideline thresholds. It does not
          diagnose, does not issue clearance, and its tolerance estimates are not validated in
          humans.
        </p>
      </footer>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Peak severity over time, with breaches marked. Drawn rather than tabulated
 * because the shape of a recovery is the first thing a clinician looks for and
 * the last thing a table conveys.
 */
function Trajectory({ summary }: { summary: ClinicianSummary }) {
  const points = summary.trajectory;
  if (points.length < 2) {
    return <p className="mt-4 text-sm text-ink-soft">Not enough days yet to plot a trend.</p>;
  }

  const width = 640;
  const height = 140;
  const padding = 16;
  const stepX = (width - padding * 2) / (points.length - 1);
  const y = (severity: number) => padding + (1 - severity / 10) * (height - padding * 2);

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${padding + index * stepX} ${y(point.worstSeverity)}`)
    .join(' ');

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Peak daily symptom severity from ${points[0].day} to ${points.at(-1)!.day}, ranging ${Math.min(...points.map((p) => p.worstSeverity)).toFixed(1)} to ${Math.max(...points.map((p) => p.worstSeverity)).toFixed(1)} on a 0 to 10 scale.`}
        className="block h-auto w-full text-ink-soft"
      >
        {[0, 5, 10].map((mark) => (
          <g key={mark}>
            <line
              x1={padding}
              x2={width - padding}
              y1={y(mark)}
              y2={y(mark)}
              stroke="currentColor"
              strokeWidth="0.5"
              opacity="0.25"
            />
            <text x={0} y={y(mark) + 3} fontSize="9" fill="currentColor" opacity="0.6">
              {mark}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" />
        {points.map((point, index) => (
          <circle
            key={point.day}
            cx={padding + index * stepX}
            cy={y(point.worstSeverity)}
            r={point.exceeded || point.redFlagged ? 4 : 2.5}
            fill={point.redFlagged || point.exceeded ? 'var(--nv-caution)' : 'currentColor'}
          />
        ))}
      </svg>
      <figcaption className="mt-2 font-mono text-xs text-ink-faint">
        {summary.flareDays.length} of {points.length} days breached the mild-and-brief limit
        {summary.redFlagDays.length > 0 && `, ${summary.redFlagDays.length} red-flag`}.
      </figcaption>
    </figure>
  );
}
