'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PROTOCOLS, stepOf } from '@/data/guidelines';
import { LOAD_DOMAINS, LOAD_DOMAIN_LABELS, type LoadDomain } from '@/data/guidelines';
import { recordCaps, recordClearance } from '@/app/s/[token]/clinician-actions';
import { useAnnounce } from '@/components/ui/Announcer';

type Props = {
  token: string;
  patientName: string;
  currentSportStep: number;
  clearedUpTo: number | null;
  clearedBy: string | null;
  currentCaps: Partial<Record<LoadDomain, number>>;
  /**
   * Only a patient on the sport ladder has a clearance gate. Return-to-Learn
   * needs no clearance at any step, and offering to record one there would
   * contradict the thing this product is most careful to say.
   */
  showClearance: boolean;
};

/**
 * Caps offered per domain, in that domain's own unit. A short list rather than
 * a free number: the common clinical instructions are "none at all" and "keep
 * it short", and a text field invites a typo into a hard constraint.
 */
const CAP_OPTIONS: Record<LoadDomain, readonly { label: string; value: number }[]> = {
  cognitive: [
    { label: 'None', value: 0 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
  ],
  visualVestibular: [
    { label: 'None', value: 0 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
  ],
  physical: [
    { label: 'None', value: 0 },
    { label: '10 min', value: 10 },
    { label: '20 min', value: 20 },
    { label: '45 min', value: 45 },
  ],
  emotionalAutonomic: [
    { label: 'None', value: 0 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
  ],
  sleepFatigue: [],
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
  currentCaps,
  showClearance,
}: Props) {
  const router = useRouter();
  const announce = useAnnounce();
  const protocol = PROTOCOLS['return-to-sport'];
  const [name, setName] = useState('');
  const [step, setStep] = useState(Math.min(6, Math.max(4, currentSportStep + 1)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<Partial<Record<LoadDomain, number>>>(currentCaps);
  const [capsBusy, setCapsBusy] = useState(false);

  const cappable = LOAD_DOMAINS.filter((domain) => CAP_OPTIONS[domain].length > 0);

  return (
    <section className="border border-rule bg-surface p-5 print:hidden">
      {showClearance ? (
        <>
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
              announce(
                `Recorded: ${patientName} cleared up to step ${step}, attributed to ${name.trim()}.`,
              );
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
        </>
      ) : (
        <>
          <h2 className="text-xl">Recording your decisions</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
            {patientName} is on the return-to-learn ladder, which needs no medical clearance at
            any step — the guidance is explicit about that, and NaviTBI will not ask for one. What
            you can do here is set limits that override what it would otherwise recommend.
          </p>
        </>
      )}

      <div className={`${showClearance ? 'mt-10 border-t border-rule pt-6' : 'mt-6'}`}>
        <h3 className="text-lg">Set a hard limit</h3>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
          If you want {patientName} kept below a specific ceiling, set it here. These outrank
          everything NaviTBI would otherwise recommend, including the minimum activity the
          guideline suggests — a general default has no business overriding you. They restrict
          only: a ceiling above what the plan already allows changes nothing.
        </p>

        <ul className="mt-5 flex flex-col gap-3">
          {cappable.map((domain) => (
            <li key={domain} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[14rem] text-sm">{LOAD_DOMAIN_LABELS[domain]}</span>
              <button
                type="button"
                onClick={() =>
                  setCaps((prev) => {
                    const next = { ...prev };
                    delete next[domain];
                    return next;
                  })
                }
                aria-pressed={caps[domain] === undefined}
                className={`min-h-0 border px-3 py-1.5 font-mono text-xs ${
                  caps[domain] === undefined
                    ? 'border-accent text-accent'
                    : 'border-rule text-ink-soft'
                }`}
              >
                No limit
              </button>
              {CAP_OPTIONS[domain].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setCaps((prev) => ({ ...prev, [domain]: option.value }))}
                  aria-pressed={caps[domain] === option.value}
                  className={`min-h-0 border px-3 py-1.5 font-mono text-xs ${
                    caps[domain] === option.value
                      ? 'border-accent bg-accent text-ground'
                      : 'border-rule text-ink-soft'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={capsBusy}
          onClick={async () => {
            setCapsBusy(true);
            setError(null);
            try {
              await recordCaps({ token, caps: caps as Record<string, number> });
              const set = Object.keys(caps).length;
              announce(
                set === 0
                  ? `Limits cleared. ${patientName}'s plan is back to what the guideline allows.`
                  : `Recorded ${set} hard limit${set === 1 ? '' : 's'} for ${patientName}.`,
              );
              router.refresh();
            } catch {
              setError('Could not record those limits. This link may no longer be active.');
            } finally {
              setCapsBusy(false);
            }
          }}
          className="mt-5 border border-accent bg-accent px-6 py-3 font-medium text-ground disabled:opacity-40"
        >
          {capsBusy ? 'Recording…' : 'Record these limits'}
        </button>
      </div>
    </section>
  );
}
