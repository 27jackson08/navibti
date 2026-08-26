'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FLAG_REASONS, FLAG_REASON_LABELS, type FlagReason } from '@/db/responses';
import { acknowledgePacket, flagItem, unflagItem } from '@/app/s/[token]/actions';
import { useAnnounce } from '@/components/ui/Announcer';

/**
 * What the school, workplace or family can send back.
 *
 * Every input is a fixed choice. A recipient is unauthenticated — holding the
 * link is the whole of their authorisation — so they may report that something
 * is not possible, and may not write prose into a clinical document or ask for
 * a limit to be raised.
 *
 * All three controls report failure rather than swallowing it. A link can be
 * revoked between the moment this page was rendered and the moment it is
 * clicked, and the server action throws when that happens. Silently returning
 * the button to its resting state leaves a recipient believing they have told
 * the patient something they have not — the one outcome this whole surface
 * exists to prevent.
 */

const DEAD_LINK = 'That did not save — this link may no longer be active. Ask for a new one.';

export function AcknowledgeButton({
  token,
  acknowledgedAt,
}: {
  token: string;
  acknowledgedAt: string | null;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (acknowledgedAt) {
    return (
      <p className="font-mono text-xs text-ink-faint">
        Receipt confirmed {acknowledgedAt.slice(0, 10)}. The patient can see this.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await acknowledgePacket({ token });
            announce('Receipt confirmed. The patient can see that this arrived.');
            router.refresh();
          } catch {
            setError(DEAD_LINK);
          } finally {
            setBusy(false);
          }
        }}
        className="border border-accent bg-accent px-5 py-3 font-medium text-ground disabled:opacity-40"
      >
        {busy ? 'Confirming…' : 'Confirm we’ve received this'}
      </button>
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}

export function FlagControl({
  token,
  accommodationId,
  itemText,
}: {
  token: string;
  accommodationId: string;
  /** Named so the control is distinguishable in a list of identical buttons. */
  itemText: string;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`We can’t do this: ${itemText}`}
        onClick={() => setOpen(true)}
        className="min-h-0 border-b border-dotted border-ink-faint pb-0.5 text-sm text-ink-soft hover:text-ink"
      >
        We can’t do this
      </button>
    );
  }

  return (
    <div className="mt-2 border border-rule bg-surface-sunken p-3">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-faint">
        Why not?
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {FLAG_REASONS.map((reason) => (
          <li key={reason}>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await flagItem({ token, accommodationId, reason: reason as FlagReason });
                  announce(
                    `Reported as not possible: ${itemText}. The plan has been adjusted to stop assuming it.`,
                  );
                  router.refresh();
                } catch {
                  setError(DEAD_LINK);
                } finally {
                  setBusy(false);
                }
              }}
              className="min-h-0 w-full border border-rule bg-ground px-3 py-2 text-left text-sm hover:border-ink-faint"
            >
              {FLAG_REASON_LABELS[reason]}
            </button>
          </li>
        ))}
      </ul>
      {error && <ErrorLine>{error}</ErrorLine>}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 min-h-0 font-mono text-xs text-ink-faint"
      >
        Cancel
      </button>
    </div>
  );
}

export function UnflagButton({
  token,
  accommodationId,
  itemText,
}: {
  token: string;
  accommodationId: string;
  itemText: string;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-label={`Actually, we can: ${itemText}`}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await unflagItem({ token, accommodationId });
            announce(`Withdrawn: ${itemText} is back in the plan.`);
            router.refresh();
          } catch {
            setError(DEAD_LINK);
          } finally {
            setBusy(false);
          }
        }}
        className="min-h-0 font-mono text-xs text-accent disabled:opacity-40"
      >
        {busy ? 'Undoing…' : 'Actually, we can'}
      </button>
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 border-l-2 border-critical bg-critical-surface p-2 text-sm">
      {children}
    </p>
  );
}
