import type { ReactNode } from 'react';

type Tone = 'critical' | 'caution' | 'steady' | 'neutral';

type Props = {
  tone: Tone;
  label: string;
  children: ReactNode;
};

const TONE_CLASS: Record<Tone, string> = {
  critical: 'border-critical bg-critical-surface',
  caution: 'border-caution bg-caution-surface',
  steady: 'border-steady bg-steady-surface',
  neutral: 'border-rule bg-surface',
};

/**
 * Severity is carried by the label and the border, never by colour alone —
 * these pages are read by people with visual symptoms and by people who print
 * them in black and white for a school office.
 */
export function Notice({ tone, label, children }: Props) {
  return (
    <section className={`border-l-2 p-4 ${TONE_CLASS[tone]}`}>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
