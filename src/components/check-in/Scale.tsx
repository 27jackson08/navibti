'use client';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
  legend: string;
};

/**
 * The 0-10 severity scale, as eleven large targets rather than a slider.
 *
 * A slider needs a sustained fine motor gesture and gives no feedback until it
 * lands. Discrete buttons are one tap, hold their value visibly, and are
 * reachable by keyboard and screen reader without any custom ARIA.
 *
 * Deliberately toggle buttons rather than a radiogroup. A radiogroup is the
 * more precise semantic, but it obliges roving tabindex and arrow-key handling
 * — more custom ARIA to get wrong, on the surface used daily by someone with
 * active symptoms, in exchange for a position announcement. Eleven plain
 * buttons work everywhere.
 */
export function Scale({ value, onChange, lowLabel, highLabel, legend }: Props) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            // What the ends of the scale mean is printed under the row, which a
            // reader moving button to button never reaches. Carrying it on the
            // endpoints themselves is the difference between "zero, button" and
            // "zero, none at all".
            aria-label={
              score === 0 ? `0 — ${lowLabel}` : score === 10 ? `10 — ${highLabel}` : undefined
            }
            aria-pressed={value === score}
            className={`flex aspect-square items-center justify-center border font-mono text-lg tabular-nums ${
              value === score
                ? 'border-accent bg-accent text-ground'
                : 'border-rule bg-surface hover:border-ink-faint'
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <p className="mt-3 flex justify-between font-mono text-xs text-ink-faint">
        <span>0 — {lowLabel}</span>
        <span>10 — {highLabel}</span>
      </p>
    </fieldset>
  );
}
