'use client';

/**
 * Reading comfort controls, kept at the top of every page rather than buried in
 * a settings screen.
 *
 * For these users this is not a preference pane. Someone whose symptoms are
 * flaring needs to dim the page in the moment, and asking them to navigate two
 * levels deep to do it is asking them to endure the bright version first.
 */

import {
  SURFACE_KEY,
  TEXT_KEY,
  setPreference,
  useDisplayPreference,
} from '@/hooks/useDisplayPreference';

const SURFACES = [
  { id: 'calm', label: 'Calm' },
  { id: 'dim', label: 'Dim' },
  { id: 'night', label: 'Night' },
] as const;

const TEXT_SIZES = [
  { id: 'default', label: 'A', title: 'Default text size' },
  { id: 'large', label: 'A', title: 'Larger text' },
  { id: 'larger', label: 'A', title: 'Largest text' },
] as const;

export function SurfaceControls() {
  const surface = useDisplayPreference(SURFACE_KEY);
  const textSize = useDisplayPreference(TEXT_KEY) ?? 'default';

  return (
    // Never on paper. The print block strips the palette to ink-on-white; this
    // is the "app furniture" half of that same intent, which was described in
    // the stylesheet comment and never actually implemented.
    <div className="border-b border-rule print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-2">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
          Reading comfort
        </span>
        <div className="flex items-center gap-4">
          <fieldset className="flex items-center gap-1">
            <legend className="sr-only">Screen brightness</legend>
            {SURFACES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreference(SURFACE_KEY, option.id)}
                aria-pressed={surface === option.id}
                className={`min-h-0 border px-3 py-1 font-mono text-xs tracking-wide ${
                  surface === option.id
                    ? 'border-accent text-accent'
                    : 'border-rule text-ink-soft hover:border-ink-faint'
                }`}
              >
                {option.label}
              </button>
            ))}
          </fieldset>

          <fieldset className="flex items-baseline gap-1">
            <legend className="sr-only">Text size</legend>
            {TEXT_SIZES.map((option, index) => (
              <button
                key={option.id}
                type="button"
                title={option.title}
                onClick={() =>
                  setPreference(TEXT_KEY, option.id === 'default' ? null : option.id)
                }
                aria-pressed={textSize === option.id}
                className={`min-h-0 border px-2 py-1 leading-none ${
                  textSize === option.id
                    ? 'border-accent text-accent'
                    : 'border-rule text-ink-soft hover:border-ink-faint'
                }`}
                style={{ fontSize: `${0.72 + index * 0.16}rem` }}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        </div>
      </div>
    </div>
  );
}
