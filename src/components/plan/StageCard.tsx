import { PROTOCOLS, clearanceRequirement, stepOf } from '@/data/guidelines';
import type { StageDecision, StageState } from '@/engine/stage/types';

type Props = {
  stage: StageState;
  decision: StageDecision | null;
};

export function StageCard({ stage, decision }: Props) {
  const protocol = PROTOCOLS[stage.protocol];
  const step = stepOf(protocol, stage.step);
  const total = protocol.steps.length;

  return (
    <section className="border border-rule bg-surface p-5">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
        {protocol.name}
      </p>

      <h2 className="mt-2 text-2xl">
        Step {stage.step} of {total} — {step.title}
      </h2>

      <ol className="mt-4 flex gap-1" aria-label={`Step ${stage.step} of ${total}`}>
        {protocol.steps.map((entry) => (
          <li
            key={entry.step}
            title={entry.title}
            className={`h-1.5 flex-1 ${
              entry.step < stage.step
                ? 'bg-accent'
                : entry.step === stage.step
                  ? 'bg-accent'
                  : 'bg-surface-sunken'
            }`}
          />
        ))}
      </ol>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">{step.examples}</p>

      {step.additionalPrerequisites.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {step.additionalPrerequisites.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      )}

      {decision?.kind === 'blocked' && (
        <div className="mt-4 border-l-2 border-caution bg-caution-surface p-3 text-sm">
          <p className="font-semibold">Step {decision.blockedFrom} is not open yet.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {decision.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 font-mono text-xs leading-relaxed text-ink-faint">
        {clearanceRequirement(stage.protocol)}
      </p>
    </section>
  );
}
