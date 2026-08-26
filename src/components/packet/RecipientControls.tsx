'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FLAG_REASONS, FLAG_REASON_LABELS, type FlagReason } from '@/db/responses';
import { acknowledgePacket, flagItem, unflagItem } from '@/app/s/[token]/actions';

/**
 * What the school, workplace or family can send back.
 *
 * Every input is a fixed choice. A recipient is unauthenticated — holding the
 * link is the whole of their authorisation — so they may report that something
 * is not possible, and may not write prose into a clinical document or ask for
 * a limit to be raised.
 */

export function AcknowledgeButton({
  token,
  acknowledgedAt,
}: {
  token: string;
  acknowledgedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (acknowledgedAt) {
    return (
      <p className="font-mono text-xs text-ink-faint">
        Receipt confirmed {acknowledgedAt.slice(0, 10)}. The patient can see this.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await acknowledgePacket({ token });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="border border-accent bg-accent px-5 py-3 font-medium text-ground disabled:opacity-40"
    >
      {busy ? 'Confirming…' : 'Confirm we’ve received this'}
    </button>
  );
}

export function FlagControl({
  token,
  accommodationId,
}: {
  token: string;
  accommodationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
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
                try {
                  await flagItem({ token, accommodationId, reason: reason as FlagReason });
                  router.refresh();
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
}: {
  token: string;
  accommodationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await unflagItem({ token, accommodationId });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="min-h-0 font-mono text-xs text-accent"
    >
      {busy ? 'Undoing…' : 'Actually, we can'}
    </button>
  );
}
