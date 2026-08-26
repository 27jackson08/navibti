import { LOAD_DOMAIN_LABELS } from '@/data/guidelines';
import type { DomainRecommendation } from '@/engine/tolerance/threshold';

type Props = {
  recommendation: DomainRecommendation;
};

const BAND_LABEL: Record<DomainRecommendation['band'], string> = {
  'very-low': 'Very limited',
  low: 'Limited',
  moderate: 'Moderate',
  'near-full': 'Near normal',
};

/**
 * Why a number is what it is matters as much as the number.
 *
 * "We think you can manage 40 minutes" and "the guideline caps this at 40
 * minutes regardless of what we think" are acted on completely differently by a
 * patient deciding whether to push, so the binding constraint is stated rather
 * than hidden behind a single figure.
 */
const BINDING_COPY: Record<DomainRecommendation['binding'], string> = {
  model: 'Based on your own last few days.',
  ramp: 'Held back to a gradual step up from yesterday.',
  stage: 'Capped by the stage you are at.',
  floor: 'Raised to the minimum the guidance supports.',
  environment:
    'Lowered because support this depends on has been reported unavailable.',
};

function format(dose: number, unit: string): string {
  if (unit.includes('sleep')) return `${dose.toFixed(1)}`;
  return `${Math.round(dose)}`;
}

/**
 * A recommendation of zero is a guideline instruction to minimise, not a claim
 * that zero is achievable. "0 minutes" reads as a prohibition nobody can meet
 * and quietly teaches the patient to ignore the number.
 */
function isMinimise(dose: number, unit: string): boolean {
  return !unit.includes('sleep') && Math.round(dose) === 0;
}

export function DoseCard({ recommendation }: Props) {
  const { domain, dose, unit, binding, modelTolerance, rampCap, stageCap, band } = recommendation;

  const scale = Math.max(dose, modelTolerance, rampCap, stageCap, 1);
  const marks = [
    { key: 'model', value: modelTolerance, title: 'What your own data supports' },
    { key: 'ramp', value: rampCap, title: 'Gradual step up from yesterday' },
    { key: 'stage', value: stageCap, title: 'Stage ceiling' },
  ];

  return (
    <article className="flex flex-col gap-3 border border-rule bg-surface p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">{LOAD_DOMAIN_LABELS[domain]}</h3>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink-faint">
          {BAND_LABEL[band]}
        </span>
      </header>

      {isMinimise(dose, unit) ? (
        <p className="text-2xl">As little as you can manage</p>
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-4xl tabular-nums">{format(dose, unit)}</span>
          <span className="text-sm text-ink-soft">{unit}</span>
        </p>
      )}

      <div
        className="relative h-2 w-full bg-surface-sunken"
        role="img"
        aria-label={
          isMinimise(dose, unit)
            ? `As little as possible. ${BINDING_COPY[binding]}`
            : `${format(dose, unit)} of ${unit}. ${BINDING_COPY[binding]}`
        }
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent"
          style={{ width: `${Math.min(100, (dose / scale) * 100)}%` }}
        />
        {marks.map((mark) => (
          <span
            key={mark.key}
            title={mark.title}
            className="absolute top-[-3px] h-[14px] w-px bg-ink-faint"
            style={{ left: `${Math.min(100, (mark.value / scale) * 100)}%` }}
          />
        ))}
      </div>

      <p className="text-sm text-ink-soft">{BINDING_COPY[binding]}</p>

    </article>
  );
}
