import { LOAD_DOMAINS, LOAD_DOMAIN_LABELS, type LoadDomain } from '@/data/guidelines';
import type { HistoryDay } from '@/engine/history';
import { normalizeDose } from '@/engine/tolerance/units';

type Props = {
  history: readonly HistoryDay[];
};

/**
 * One small chart per domain: what was recommended, what was actually done, and
 * which days breached the limit.
 *
 * Small multiples rather than one combined chart because the domains are on
 * different units and recover at different rates — the whole reason they are
 * tracked separately. Overlaying them would put minutes of reading and hours of
 * sleep debt on one axis and say nothing.
 */
export function HistoryChart({ history }: Props) {
  if (history.length < 2) {
    return (
      <p className="text-ink-soft">
        Two days of check-ins are needed before there is a shape to show.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {LOAD_DOMAINS.filter((domain) => domain !== 'sleepFatigue').map((domain) => (
        <DomainChart key={domain} domain={domain} history={history} />
      ))}
    </div>
  );
}

function DomainChart({ domain, history }: { domain: LoadDomain; history: readonly HistoryDay[] }) {
  const width = 320;
  const height = 110;
  const pad = 14;

  const values = history.flatMap((day) => [
    normalizeDose(domain, day.recommended[domain] ?? 0),
    normalizeDose(domain, day.actual[domain] ?? 0),
  ]);
  const ceiling = Math.max(0.3, ...values);

  const x = (index: number) => pad + (index / (history.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - (value / ceiling) * (height - pad * 2);

  const planned = history
    .map((day, index) => {
      const value = day.recommended[domain];
      return value === undefined
        ? null
        : `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(normalizeDose(domain, value))}`;
    })
    .filter(Boolean)
    .join(' ');

  const latest = history.at(-1)!.recommended[domain] ?? 0;
  const unit = domain === 'physical' ? 'exertion-weighted min' : 'minutes';

  return (
    <figure className="border border-rule bg-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{LOAD_DOMAIN_LABELS[domain]}</span>
        <span className="font-mono text-xs tabular-nums text-ink-soft">
          {Math.round(latest)} {unit}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${LOAD_DOMAIN_LABELS[domain]}: recommended load rose from ${Math.round(
          history[0].recommended[domain] ?? 0,
        )} to ${Math.round(latest)} ${unit} over ${history.length} days.`}
        className="mt-3 block h-auto w-full text-accent"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad}
          y2={height - pad}
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.3"
        />

        {/* What was actually done, as bars behind the plan line. */}
        {history.map((day, index) => {
          const value = day.actual[domain];
          if (value === undefined) return null;
          const top = y(normalizeDose(domain, value));
          return (
            <line
              key={day.day}
              x1={x(index)}
              x2={x(index)}
              y1={height - pad}
              y2={top}
              stroke="var(--nv-ink-faint)"
              strokeWidth="3"
              opacity="0.35"
            />
          );
        })}

        <path d={planned} fill="none" stroke="currentColor" strokeWidth="1.75" />

        {history.map((day, index) => {
          const value = day.recommended[domain];
          if (value === undefined) return null;
          const flagged = day.exceeded || day.redFlagged;
          return (
            <circle
              key={day.day}
              cx={x(index)}
              cy={y(normalizeDose(domain, value))}
              r={flagged ? 3.5 : 2}
              fill={flagged ? 'var(--nv-caution)' : 'currentColor'}
            />
          );
        })}
      </svg>

      <p className="mt-2 font-mono text-[0.66rem] leading-relaxed text-ink-faint">
        Line: what was recommended. Bars: what was actually done. Marked points breached the
        two-point limit.
      </p>
    </figure>
  );
}
