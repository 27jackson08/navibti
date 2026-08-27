import Link from 'next/link';
import {
  CITATIONS,
  DOMAIN_MECHANISMS,
  LOAD_DOMAINS,
  LOAD_DOMAIN_LABELS,
  SUBTYPE_LABELS,
  UNTRACKED_PRESENTATIONS,
} from '@/data/guidelines';
import { joinWords } from '@/lib/list';

export const metadata = {
  title: 'How NaviTBI models recovery',
  description:
    'Why these five kinds of load, what each one is tracking, and where the model stops.',
};

export default function HowItWorks() {
  const cited = [
    ...new Set(LOAD_DOMAINS.flatMap((domain) => DOMAIN_MECHANISMS[domain].citations)),
  ];

  return (
    <main className="mx-auto w-full max-w-[72ch] flex-1 px-5 py-10">
      <nav>
        <Link href="/" className="font-mono text-xs text-ink-faint hover:text-ink">
          ← Patients
        </Link>
      </nav>

      <h1 className="mt-8 text-[clamp(2rem,1.5rem+2.4vw,3rem)] leading-[1.06]">
        Capacity is a budget, not a matter of effort
      </h1>

      <p className="mt-5 text-lg leading-relaxed text-ink-soft">
        After a concussion the brain goes through an ionic flux and a period of raised energy
        demand at exactly the moment its ability to meet that demand is reduced. The problem is
        metabolic rather than structural — which is why capacity is finite, why exceeding it
        produces symptoms without producing damage, and why pushing harder does not work.
      </p>

      <p className="mt-4 leading-relaxed">
        It is also why sub-threshold activity is the treatment rather than a reward for
        recovering. The budget rebuilds by being used up to its limit and not beyond, so the
        guideline threshold — no more than a two-point rise over the pre-activity value, lasting
        no more than an hour — is not an arbitrary line. It is the edge of the budget.
      </p>

      <p className="mt-4 leading-relaxed">
        NaviTBI tracks five kinds of load because they draw on different systems, recover at
        different rates, and are accommodated in completely different ways by a school or a
        workplace. Averaging them into a single &ldquo;activity&rdquo; number loses the thing that
        makes the output actionable.
      </p>

      <div className="mt-12 flex flex-col gap-10">
        {LOAD_DOMAINS.map((domain) => {
          const mechanism = DOMAIN_MECHANISMS[domain];
          return (
            <article key={domain} className="border-t border-rule pt-6">
              <h2 className="text-2xl">{LOAD_DOMAIN_LABELS[domain]}</h2>
              <p className="mt-2 text-ink-soft">{mechanism.loads}</p>

              <h3 className="mt-5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                Why there is less room for it
              </h3>
              <p className="mt-2 leading-relaxed">{mechanism.mechanism}</p>

              <h3 className="mt-5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                Why exposure, not avoidance
              </h3>
              <p className="mt-2 leading-relaxed">{mechanism.reexposure}</p>

              {mechanism.resembles.length > 0 && (
                <p className="mt-5 border-l-2 border-rule pl-4 text-sm text-ink-soft">
                  A pattern concentrated here resembles{' '}
                  {joinWords(
                    mechanism.resembles.map((subtype) => SUBTYPE_LABELS[subtype]),
                    'or',
                  )}{' '}
                  presentations in the subtype literature. NaviTBI describes the resemblance; it
                  does not assign anyone a subtype, which is a clinical judgement made with an
                  examination rather than from self-reported minutes.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <section className="mt-14 border-t border-rule pt-6">
        <h2 className="text-2xl">What this does not track</h2>
        <p className="mt-2 leading-relaxed text-ink-soft">
          Five domains are not the whole picture, and leaving the gaps unstated would imply they
          were.
        </p>
        <ul className="mt-5 flex flex-col gap-4">
          {UNTRACKED_PRESENTATIONS.map((item) => (
            <li key={item.subtype}>
              <h3 className="font-semibold capitalize">{SUBTYPE_LABELS[item.subtype]}</h3>
              <p className="mt-1 leading-relaxed text-ink-soft">{item.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-14 border-t border-rule pt-6">
        <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
          Sources
        </h2>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
          {cited.map((id) => (
            <li key={id}>
              {CITATIONS[id].authors} <em>{CITATIONS[id].title}</em>. {CITATIONS[id].source}.
            </li>
          ))}
        </ol>
        <p className="mt-6 border-l-2 border-caution bg-caution-surface p-4 text-sm leading-relaxed">
          <strong className="font-semibold">Not medical advice.</strong> This page explains how
          NaviTBI models recovery. It is not a description of any particular person&rsquo;s injury,
          and the model is not validated in humans.
        </p>
      </footer>
    </main>
  );
}
