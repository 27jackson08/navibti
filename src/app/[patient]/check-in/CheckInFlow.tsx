'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSpeech } from '@/hooks/useSpeech';
import { Choice } from '@/components/check-in/Choice';
import { Scale } from '@/components/check-in/Scale';
import {
  DOMAIN_QUESTIONS,
  DURATION_PRESETS,
  SLEEP_PRESETS,
} from '@/data/check-in-presets';
import { RED_FLAGS, RED_FLAG_INSTRUCTION } from '@/data/guidelines';
import type { LoadDomain } from '@/data/guidelines';
import { submitCheckIn } from './actions';

type Props = {
  patientId: string;
  patientName: string;
};

type Answers = {
  redFlagIds: string[];
  preActivitySeverity: number | null;
  worstSeverity: number | null;
  deltaDurationMinutes: number | null;
  sleepDebtHours: number | null;
  doses: Partial<Record<LoadDomain, number>>;
};

const EMPTY: Answers = {
  redFlagIds: [],
  preActivitySeverity: null,
  worstSeverity: null,
  deltaDurationMinutes: null,
  sleepDebtHours: null,
  doses: {},
};

/**
 * The daily check-in.
 *
 * Red flags are asked first and asked every day. Putting them later would mean
 * a patient with a deteriorating symptom answers four questions about screen
 * time before anyone asks the question that matters.
 */
export function CheckInFlow({ patientId, patientName }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeech();

  const rose =
    answers.worstSeverity !== null &&
    answers.preActivitySeverity !== null &&
    answers.worstSeverity > answers.preActivitySeverity;

  const steps = buildSteps(answers, rose);
  const current = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  // Before the red-flag early return, because hooks cannot be called
  // conditionally and that return sits between here and the render.
  const prompt = current.help ? `${current.title} ${current.help}` : current.title;
  useEffect(() => {
    speech.speak(prompt);
  }, [prompt, speech]);

  if (answers.redFlagIds.length > 0) {
    return (
      <section className="border-l-2 border-critical bg-critical-surface p-6">
        <h2 className="text-2xl">Stop and get medical care now</h2>
        <p className="mt-3 text-lg leading-relaxed">{RED_FLAG_INSTRUCTION}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5">
          {answers.redFlagIds.map((id) => (
            <li key={id}>{RED_FLAGS.find((flag) => flag.id === id)?.label}</li>
          ))}
        </ul>
        <p className="mt-5 text-sm">
          No plan will be generated today. NaviTBI does not give guidance on a day when a red-flag
          symptom is reported.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void save(answers)}
            className="border border-critical px-5 py-3 font-medium"
          >
            Record this and continue
          </button>
          <button
            type="button"
            onClick={() => setAnswers({ ...answers, redFlagIds: [] })}
            className="border border-rule px-5 py-3"
          >
            I selected that by mistake
          </button>
        </div>
      </section>
    );
  }

  async function save(finalAnswers: Answers) {
    setSubmitting(true);
    setError(null);
    try {
      await saveOrThrow(finalAnswers);
      router.push(`/${patientId}/today`);
    } catch {
      setError(
        `Could not save this check-in. Open ${patientName}’s record from the patient list first.`,
      );
      setSubmitting(false);
    }
  }

  async function saveOrThrow(finalAnswers: Answers) {
    await submitCheckIn({
      patientId,
      preActivitySeverity: finalAnswers.preActivitySeverity ?? 0,
      worstSeverity: finalAnswers.worstSeverity ?? finalAnswers.preActivitySeverity ?? 0,
      deltaDurationMinutes: finalAnswers.deltaDurationMinutes ?? 0,
      sleepDebtHours: finalAnswers.sleepDebtHours ?? 0,
      doses: finalAnswers.doses,
      redFlagIds: finalAnswers.redFlagIds,
    });
  }

  return (
    <>
      {speech.supported && (
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={speech.toggle}
            aria-pressed={speech.enabled}
            className={`min-h-0 border px-3 py-1.5 font-mono text-xs ${
              speech.enabled ? 'border-accent text-accent' : 'border-rule text-ink-soft'
            }`}
          >
            {speech.enabled ? 'Reading aloud — tap to stop' : 'Read questions aloud'}
          </button>
        </div>
      )}

      <ol className="flex gap-1" aria-label={`Question ${index + 1} of ${steps.length}`}>
        {steps.map((step, position) => (
          <li
            key={step.id}
            className={`h-1 flex-1 ${position <= index ? 'bg-accent' : 'bg-surface-sunken'}`}
          />
        ))}
      </ol>

      <p className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
        {index + 1} of {steps.length}
      </p>

      <h2 className="mt-3 max-w-[22ch] text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-[1.12]">
        {current.title}
      </h2>
      {current.help && <p className="mt-3 max-w-[46ch] text-ink-soft">{current.help}</p>}

      <div className="mt-8">
        {current.render(setAnswers, () => setIndex((value) => value + 1))}
      </div>

      {error && (
        <p role="alert" className="mt-6 border-l-2 border-critical bg-critical-surface p-3 text-sm">
          {error}
        </p>
      )}

      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="border border-rule px-5 py-3 text-ink-soft disabled:opacity-40"
        >
          Back
        </button>

        <button
          type="button"
          disabled={!current.answered || submitting}
          onClick={() => {
            if (isLast) void save(answers);
            else setIndex((value) => value + 1);
          }}
          className="border border-accent bg-accent px-6 py-3 font-medium text-ground disabled:opacity-40"
        >
          {submitting ? 'Saving…' : isLast ? `Finish for ${patientName}` : 'Next'}
        </button>
      </div>
    </>
  );
}

type Step = {
  id: string;
  title: string;
  help?: string;
  answered: boolean;
  render: (
    update: React.Dispatch<React.SetStateAction<Answers>>,
    advance: () => void,
  ) => React.ReactNode;
};

function buildSteps(answers: Answers, rose: boolean): Step[] {
  const steps: Step[] = [
    {
      id: 'red-flags',
      title: 'First — any of these today?',
      help: 'These need urgent medical attention rather than a plan. Most days the answer is none.',
      answered: true,
      // The common answer is "none", every day, for weeks. Making that the
      // first and largest target means the routine case is one tap, rather than
      // scrolling past ten alarming symptoms to find the Next button.
      render: (update, advance) => (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={advance}
            className="border border-accent bg-accent px-6 py-5 text-left text-xl font-medium text-ground"
          >
            None of these
          </button>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-mono text-xs uppercase tracking-[0.12em] text-ink-faint">
              Or tap one if it applies
            </legend>
            {RED_FLAGS.map((flag) => (
              <button
                key={flag.id}
                type="button"
                onClick={() => update((prev) => ({ ...prev, redFlagIds: [flag.id] }))}
                className="border border-rule bg-surface px-5 py-3 text-left hover:border-critical"
              >
                {flag.label}
              </button>
            ))}
          </fieldset>
        </div>
      ),
    },
    {
      id: 'pre',
      title: 'How are your symptoms right now?',
      help: 'Before you think about the rest of the day — just this moment.',
      answered: answers.preActivitySeverity !== null,
      render: (update) => (
        <Scale
          legend="Symptoms right now"
          value={answers.preActivitySeverity}
          onChange={(value) => update((prev) => ({ ...prev, preActivitySeverity: value }))}
          lowLabel="none at all"
          highLabel="as bad as it gets"
        />
      ),
    },
    {
      id: 'worst',
      title: 'What was the worst they got today?',
      help: 'The peak, even if it settled again afterwards.',
      answered: answers.worstSeverity !== null,
      render: (update) => (
        <Scale
          legend="Worst symptoms today"
          value={answers.worstSeverity}
          onChange={(value) => update((prev) => ({ ...prev, worstSeverity: value }))}
          lowLabel="none at all"
          highLabel="as bad as it gets"
        />
      ),
    },
  ];

  // Duration only matters when something actually got worse. The guideline's
  // test is a rise of no more than two points lasting no more than an hour, so
  // a flat day has nothing to time.
  if (rose) {
    steps.push({
      id: 'duration',
      title: 'How long did that last?',
      help: 'Roughly is fine.',
      answered: answers.deltaDurationMinutes !== null,
      render: (update) => (
        <Choice
          legend="How long symptoms stayed worse"
          options={DURATION_PRESETS}
          value={answers.deltaDurationMinutes}
          onChange={(value) => update((prev) => ({ ...prev, deltaDurationMinutes: value }))}
        />
      ),
    });
  }

  steps.push({
    id: 'sleep',
    title: 'How did you sleep last night?',
    answered: answers.sleepDebtHours !== null,
    render: (update) => (
      <Choice
        legend="Sleep last night"
        options={SLEEP_PRESETS}
        value={answers.sleepDebtHours}
        onChange={(value) => update((prev) => ({ ...prev, sleepDebtHours: value }))}
      />
    ),
  });

  for (const question of DOMAIN_QUESTIONS) {
    steps.push({
      id: question.domain,
      title: question.question,
      help: question.help,
      answered: answers.doses[question.domain] !== undefined,
      render: (update) => (
        <Choice
          legend={question.question}
          options={question.presets}
          value={answers.doses[question.domain] ?? null}
          onChange={(value) =>
            update((prev) => ({ ...prev, doses: { ...prev.doses, [question.domain]: value } }))
          }
        />
      ),
    });
  }

  return steps;
}
