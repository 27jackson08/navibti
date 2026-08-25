'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { revokeLink } from './actions';

type Props = {
  patientId: string;
  linkId: string;
};

export function RevokeButton({ patientId, linkId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-0 border border-rule px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-critical hover:text-critical"
      >
        Revoke
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await revokeLink({ patientId, linkId });
          router.refresh();
        }}
        className="min-h-0 border border-critical px-3 py-1.5 font-mono text-xs text-critical"
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
    </span>
  );
}
