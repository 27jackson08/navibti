'use client';

import { useState, useTransition } from 'react';
import { withdrawUnavailable } from '@/app/[patient]/today/actions';
import { useAnnounce } from '@/components/ui/Announcer';

type Props = {
  patientId: string;
  accommodationId: string;
  /**
   * What this button restores. Several of these can sit in one list, and a
   * screen reader announcing three buttons all called "This is available again"
   * gives no way to tell which is which — so it becomes the accessible name.
   */
  label: string;
};

/**
 * "This is available again."
 *
 * Deliberately not phrased as undo. The recipient was not wrong when they said
 * it; the room really was unavailable. What changed is the room.
 */
export function WithdrawUnavailable({ patientId, accommodationId, label }: Props) {
  const announce = useAnnounce();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`This is available again: ${label}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setFailed(false);
              await withdrawUnavailable({ patientId, accommodationId });
              announce(`Restored: ${label}. Today's limits have gone back up.`);
            } catch {
              setFailed(true);
            }
          })
        }
        className="mt-1 min-h-0 border border-rule px-2 py-1 font-mono text-[0.68rem] text-ink-soft hover:border-ink hover:text-ink disabled:opacity-50"
      >
        {pending ? 'Restoring…' : 'This is available again'}
      </button>
      {failed && (
        <p role="alert" className="mt-1 text-[0.7rem] text-critical">
          Could not restore this. Try again.
        </p>
      )}
    </>
  );
}
