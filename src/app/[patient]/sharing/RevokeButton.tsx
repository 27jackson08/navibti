'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAnnounce } from '@/components/ui/Announcer';
import { revokeLink } from './actions';

type Props = {
  patientId: string;
  linkId: string;
  /**
   * Which link this revokes. A page can list a dozen, and a dozen buttons all
   * called "Revoke" are indistinguishable to anyone not looking at the row.
   */
  linkLabel: string;
};

/**
 * Revoking is the control that has to be believed.
 *
 * It had no error handling at all: if the action threw — a session no longer
 * acting as this patient is the ordinary way — the button sat on "Revoking…"
 * forever and said nothing. The user walks away certain a link to their health
 * data is dead while it is still live and still being opened. A revoke that
 * fails silently is worse than one that fails loudly.
 */
export function RevokeButton({ patientId, linkId, linkLabel }: Props) {
  const router = useRouter();
  const announce = useAnnounce();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={`Revoke the link: ${linkLabel}`}
        onClick={() => setConfirming(true)}
        className="min-h-0 border border-rule px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-critical hover:text-critical"
      >
        Revoke
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        aria-label={`Confirm revoking the link: ${linkLabel}`}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await revokeLink({ patientId, linkId });
            announce(`Revoked: ${linkLabel}. That link no longer opens.`);
            router.refresh();
          } catch {
            setError('That link was not revoked. It is still active — try again.');
          } finally {
            setBusy(false);
          }
        }}
        className="min-h-0 border border-critical px-3 py-1.5 font-mono text-xs text-critical disabled:opacity-40"
      >
        {busy ? 'Revoking…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-0 px-2 py-1.5 font-mono text-xs text-ink-faint"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full border-l-2 border-critical bg-critical-surface p-2 text-sm">
          {error}
        </p>
      )}
    </span>
  );
}
