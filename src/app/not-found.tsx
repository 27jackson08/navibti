import Link from 'next/link';

export const metadata = {
  title: 'Link not active — NaviTBI',
};

/**
 * The most-travelled unhappy path in the product, by design.
 *
 * Share links expire on a date the patient chooses and can be revoked in one
 * click, so a recipient reaching a dead one is expected rather than
 * exceptional — and until now they got Next's stock "404 | This page could not
 * be found", which tells a school office nothing about what to do next.
 *
 * The wording is identical for a revoked link, an expired one, a mistyped one
 * and a page that never existed, because `resolveToken` deliberately cannot
 * tell them apart and neither should this. Saying "this link was revoked" would
 * hand the holder of a dead token a fact about the patient.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[62ch] flex-1 px-5 py-16">
      <h1 className="text-[clamp(1.8rem,1.4rem+2vw,2.6rem)] leading-[1.1]">
        This link isn’t active
      </h1>

      <p className="mt-5 text-lg leading-relaxed text-ink-soft">
        Shared plans expire on a date the patient sets, and can be switched off at any time. This
        one is no longer open — which may mean it has expired, may mean it was turned off, or may
        mean the address was mistyped.
      </p>

      <p className="mt-4 leading-relaxed">
        Nothing has gone wrong with the patient’s record. Ask them to send a new link, and it will
        show their current plan rather than the one this address pointed at.
      </p>

      <p className="mt-8 border-l-2 border-critical bg-critical-surface p-4 leading-relaxed">
        <strong className="font-semibold">If you are worried about someone right now</strong>, do
        not wait for a link. Get urgent medical care, and call emergency services if symptoms are
        severe or worsening quickly.
      </p>

      <Link href="/" className="mt-8 inline-block font-mono text-xs text-accent">
        ← NaviTBI
      </Link>
    </main>
  );
}
