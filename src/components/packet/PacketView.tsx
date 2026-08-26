import { CITATIONS, LOAD_DOMAIN_LABELS } from '@/data/guidelines';
import { FLAG_REASON_LABELS, type FlagReason } from '@/db/responses';
import type { Packet, PacketDiff } from '@/engine/packet/compose';
import { AcknowledgeButton, FlagControl, UnflagButton } from './RecipientControls';

export type FlaggedItem = {
  id: string;
  text: string;
  reason: FlagReason;
};

type Props = {
  packet: Packet;
  diff: PacketDiff | null;
  stageLine: string;
  /**
   * Present only on the shared view. The recipient can respond; the patient
   * looking at their own copy cannot answer on their school's behalf.
   */
  respond?: {
    token: string;
    acknowledgedAt: string | null;
    flagged: readonly FlaggedItem[];
  };
};

/**
 * A packet is a document, not a screen. It gets printed, filed, forwarded and
 * read by someone who has never heard of this app — so it is laid out as a
 * letter, carries its own date and sources, and prints without the app
 * furniture around it.
 */
export function PacketView({ packet, diff, stageLine, respond }: Props) {
  return (
    <article className="mx-auto w-full max-w-[68ch]">
      <header className="border-b border-rule pb-6">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-accent">
          NaviTBI · {packet.generatedOn}
        </p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,2.8rem)] leading-[1.08]">
          {packet.title} for {packet.patientName}
        </h1>
        <p className="mt-4 leading-relaxed text-ink-soft">{packet.intro}</p>
        <p className="mt-4 font-mono text-xs text-ink-faint">{stageLine}</p>
      </header>

      {diff?.hasChanges && (
        <section className="mt-6 border-l-2 border-accent bg-accent-soft p-4 print:hidden">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">
            What changed since the last version
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {diff.added.map((item) => (
              <li key={item.id}>
                <strong>Added.</strong> {item.text}
              </li>
            ))}
            {diff.changed.map(({ after }) => (
              <li key={after.id}>
                <strong>Updated.</strong> {after.text}
              </li>
            ))}
            {diff.removed.map((item) => (
              <li key={item.id} className="text-ink-soft">
                <strong>No longer needed.</strong> {item.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {packet.emptyReason && (
        <section className="mt-8 border-l-2 border-accent bg-accent-soft p-5">
          <h2 className="text-xl">Nothing to arrange right now</h2>
          <p className="mt-3 leading-relaxed">{packet.emptyReason}</p>
        </section>
      )}

      {respond && (
        <section className="mt-8 border border-rule bg-surface p-5 print:hidden">
          <h2 className="text-lg">Can you do these?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Confirming receipt lets {packet.patientName} know this arrived. If something here is
            not possible for you, say so — some of these adjustments are what make the day safe,
            so the plan is adjusted rather than left assuming support that is not there.
          </p>
          <div className="mt-4">
            <AcknowledgeButton token={respond.token} acknowledgedAt={respond.acknowledgedAt} />
          </div>
        </section>
      )}

      <ol className="mt-8 flex flex-col gap-6">
        {packet.items.map((item, index) => (
          <li key={item.id} className="grid grid-cols-[2.5rem_1fr] gap-4">
            <span className="pt-1 font-mono text-sm tabular-nums text-ink-faint">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-lg leading-relaxed">{item.text}</p>
              <p className="mt-1.5 text-sm text-ink-soft">{item.rationale}</p>
              {respond && (
                <div className="mt-2 print:hidden">
                  <FlagControl
                    token={respond.token}
                    accommodationId={item.id}
                    itemText={item.text}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {respond && respond.flagged.length > 0 && (
        <section className="mt-10 border-l-2 border-caution bg-caution-surface p-5 print:hidden">
          <h2 className="text-lg">You’ve told us these aren’t possible</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {packet.patientName}’s plan has been adjusted to stop assuming them.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {respond.flagged.map((item) => (
              <li key={item.id} className="text-sm">
                <p className="line-through decoration-1">{item.text}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-3 text-ink-soft">
                  <span>{FLAG_REASON_LABELS[item.reason]}</span>
                  <UnflagButton
                    token={respond.token}
                    accommodationId={item.id}
                    itemText={item.text}
                  />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {packet.unsupportedDomains.length > 0 && (
        <section className="mt-8 border-l-2 border-critical bg-critical-surface p-5">
          <h2 className="text-lg">Nothing here now covers</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {packet.unsupportedDomains.map((domain) => (
              <li key={domain}>{LOAD_DOMAIN_LABELS[domain]}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed">
            Every option for this has been reported unavailable, so {packet.patientName} has no
            support for it at all. This is worth raising with their clinician.
          </p>
        </section>
      )}

      {packet.redFlags && (
        <section className="mt-10 border-2 border-critical p-5">
          <h2 className="text-xl text-critical">Get medical help immediately if you see</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {packet.redFlags.items.map((flag) => (
              <li key={flag.id} className="flex gap-2 text-sm">
                <span aria-hidden="true" className="text-critical">
                  •
                </span>
                <span>{flag.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-critical pt-3 font-medium">
            {packet.redFlags.instruction}
          </p>
        </section>
      )}

      <footer className="mt-12 border-t border-rule pt-6">
        <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
          Where this comes from
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-ink-soft">
          {packet.sources.map((source) => (
            <li key={source.id}>
              {CITATIONS[source.id].authors}. <em>{CITATIONS[source.id].title}</em>.{' '}
              {CITATIONS[source.id].source}.
            </li>
          ))}
        </ol>

        <p className="mt-6 border-l-2 border-caution bg-caution-surface p-4 text-sm leading-relaxed">
          <strong className="font-semibold">This is not medical advice.</strong> NaviTBI organises
          published guideline information alongside {packet.patientName}’s own daily reports. It
          does not diagnose, it does not issue medical clearance, and it does not replace a
          clinician. If symptoms worsen, or if any red-flag symptom appears, seek medical care
          rather than following this document.
        </p>
      </footer>
    </article>
  );
}
