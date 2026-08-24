'use client';

import type { Preset } from '@/data/check-in-presets';

type Props = {
  options: readonly Preset[];
  value: number | null;
  onChange: (value: number) => void;
  legend: string;
};

export function Choice({ options, value, onChange, legend }: Props) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex items-baseline justify-between gap-4 border px-5 py-4 text-left ${
            value === option.value
              ? 'border-accent bg-accent text-ground'
              : 'border-rule bg-surface hover:border-ink-faint'
          }`}
        >
          <span className="text-lg">{option.label}</span>
          {option.detail && (
            <span
              className={`font-mono text-xs ${
                value === option.value ? 'text-ground/80' : 'text-ink-faint'
              }`}
            >
              {option.detail}
            </span>
          )}
        </button>
      ))}
    </fieldset>
  );
}
