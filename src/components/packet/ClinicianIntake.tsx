'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PROTOCOLS, stepOf } from '@/data/guidelines';
import { recordClearance } from '@/app/s/[token]/clinician-actions';

type Props = {
  token: string;
  patientName: string;
  currentSportStep: number;
  clearedUpTo: number | null;
  clearedBy: string | null;
};

/**
 * Where clearance actually enters the system.
 *
 * NaviTBI never decides this. It records that a named person decided it, on a
 * date, covering a specific step — and the stage machine still refuses to
 * advance anyone on its own. Without this surface the sport ladder dead-ends at
 * step 3 forever, which is where it stood until now.
 */
export function ClinicianIntake({
  token,
  patientName,
  currentSportStep,
  clearedUpTo,
  clearedBy,
}: Props) {
  const router = useRouter();
  const protocol = PROTOCOLS['return-to-sport'];
  const [name, setName] = useState('');
  const [step, setStep] = useState(Math.min(6, Math.max(4, currentSportStep + 1)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="border border-rule bg-surface p-5 print:hidden">
      <h2 className="text-xl">Record a clearance decision</h2>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
        {patientName} is at step {currentSportStep} of {protocol.steps.length}. Steps 4 and above
        need written medical clearance, and NaviTBI will not advance anyone on its own. If you have
        cleared {patientName}, record it here and it will be attributed to you.
      </p>

      {clearedUpTo !== null && (
        <p className="mt-3 border-l-2 border-steady bg-steady-surface p-3 text-sm">
          Currently cleared up to step {clearedUpTo}
          {clearedBy ? `, recorded by ${clearedBy}` : ''}.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
            Your name, for the record
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Dr Amara Reyes"
            maxLength={80}
            className="border border-rule bg-ground px-4 py-3"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
            Cleared up to and including
          </legend>
          <div className="flex flex-wrap gap-2">
            {[4, 5, 6].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStep(option)}
                aria-pressed={step === option}
                className={`min-h-0 border px-4 py-2 text-left text-sm ${
                  step === option ? 'border-accent bg-accent text-ground' : 'border-rule'
                }`}
              >
                Step {option} — {stepOf(protocol, option).title}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="border-l-2 border-critical bg-critical-surface p-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy || name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await recordClearance({ token, recordedBy: name.trim(), coversUpToStep: step });
              setName('');
              router.refresh();
            } catch {
              setError('Could not record that. This link may no longer be active.');
            } finally {
              setBusy(false);
            }
          }}
          className="self-start border border-accent bg-accent px-6 py-3 font-medium text-ground disabled:opacity-40"
        >
          {busy ? 'Recording…' : 'Record clearance'}
        </button>

        <p className="font-mono text-xs leading-relaxed text-ink-faint">
          This records your decision. It does not make one. {patientName} still cannot progress
          past a step until they have also tolerated the one before it, and a full return to school
          is required before step 4 regardless of clearance.
        </p>
      </div>
    </section>
  );
}
