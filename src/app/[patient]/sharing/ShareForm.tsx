'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { canShareRawSymptoms, type ShareRole } from '@/db/share';
import { createLink } from './actions';

type Props = {
  patientId: string;
  patientName: string;
  roles: readonly ShareRole[];
};

const EXPIRY_OPTIONS = [7, 14, 30] as const;

export function ShareForm({ patientId, patientName, roles }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<ShareRole>(roles[0]);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<(typeof EXPIRY_OPTIONS)[number]>(14);
  const [includesRawSymptoms, setIncludesRawSymptoms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawAllowed = canShareRawSymptoms(role);

  return (
    <form
      className="flex flex-col gap-6 border border-rule bg-surface p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await createLink({
            patientId,
            role,
            includesRawSymptoms: includesRawSymptoms && rawAllowed,
            expiresInDays,
            label: label.trim() || `${role} link`,
          });
          setLabel('');
          router.refresh();
        } catch {
          // The server rejected it — most likely this session is not acting as
          // this patient. Say so plainly rather than leaving the button stuck.
          setError(
            `Could not create the link. Open ${patientName}’s record from the patient list first.`,
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
          Who is this for
        </legend>
        <div className="flex flex-wrap gap-2">
          {roles.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setRole(option);
                if (!canShareRawSymptoms(option)) setIncludesRawSymptoms(false);
              }}
              aria-pressed={role === option}
              className={`min-h-0 border px-4 py-2 capitalize ${
                role === option ? 'border-accent bg-accent text-ground' : 'border-rule'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
          Label — so {patientName} can tell links apart later
        </span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Ms Okafor, Year 11 tutor"
          maxLength={120}
          className="border border-rule bg-ground px-4 py-3"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
          Expires after
        </legend>
        <div className="flex gap-2">
          {EXPIRY_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setExpiresInDays(days)}
              aria-pressed={expiresInDays === days}
              className={`min-h-0 border px-4 py-2 font-mono text-sm ${
                expiresInDays === days ? 'border-accent bg-accent text-ground' : 'border-rule'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={includesRawSymptoms}
            disabled={!rawAllowed}
            onChange={(event) => setIncludesRawSymptoms(event.target.checked)}
            className="mt-1 min-h-0 size-5"
          />
          <span className="text-sm leading-relaxed">
            Include day-by-day symptom scores
            {!rawAllowed && (
              <span className="mt-1 block text-ink-soft">
                Not available for a {role} link. They need to know what {patientName} can manage,
                not their daily symptom ratings.
              </span>
            )}
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-critical bg-critical-surface p-3 text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="self-start border border-accent bg-accent px-6 py-3 font-medium text-ground disabled:opacity-40"
      >
        {busy ? 'Creating…' : 'Create link'}
      </button>
    </form>
  );
}
