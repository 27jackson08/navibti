'use client';

import Link from 'next/link';

/**
 * What a reader sees when something breaks.
 *
 * Next's default is "Application error: a server-side exception has occurred",
 * which is a reasonable thing to show on a shopping site and the wrong thing to
 * show to someone holding a clinical document. Two things have to survive an
 * error: the person needs somewhere to go, and the one instruction this product
 * never withholds has to still be on the page.
 *
 * The error itself is not printed. A stack trace tells a recipient nothing and
 * a digest is the supported way to correlate a report with a server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[62ch] flex-1 px-5 py-16">
      <h1 className="text-[clamp(1.8rem,1.4rem+2vw,2.6rem)] leading-[1.1]">
        Something went wrong on our side
      </h1>

      <p className="mt-5 text-lg leading-relaxed text-ink-soft">
        This is a fault in NaviTBI, not in the record it was showing you. Nothing has been changed
        or lost.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="border border-accent bg-accent px-5 py-3 font-medium text-ground"
        >
          Try again
        </button>
        <Link href="/" className="font-mono text-xs text-accent">
          ← Start over
        </Link>
      </div>

      <p className="mt-10 border-l-2 border-critical bg-critical-surface p-4 leading-relaxed">
        <strong className="font-semibold">Do not wait for this to work.</strong> If someone has a
        symptom that worries you, get urgent medical care now — do not wait to see if it improves,
        and call emergency services if symptoms are severe or worsening quickly.
      </p>

      {error.digest && (
        <p className="mt-6 font-mono text-xs text-ink-faint">Reference: {error.digest}</p>
      )}
    </main>
  );
}
