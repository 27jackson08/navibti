/**
 * CRT6 red flags — the emergency-care list.
 *
 * If any of these is present, NaviTBI generates NO plan, NO tolerance estimate,
 * and NO accommodation packet. It shows one screen telling the person to seek
 * urgent medical care. This is the only place in the product where we interrupt
 * the user rather than inform them.
 *
 * The CRT6 is explicitly not a diagnostic instrument. We are using it the way it
 * is meant to be used: by a non-clinician, to decide whether to seek help now.
 */

import type { CitationId } from './citations';

export interface RedFlag {
  readonly id: string;
  /** Shown in the red-flag card and the caregiver packet. */
  readonly label: string;
  /** How the daily check-in asks about it, in second person, plainly. */
  readonly prompt: string;
  readonly citation: CitationId;
}

export const RED_FLAGS: readonly RedFlag[] = [
  {
    id: 'neck-pain',
    label: 'Neck pain or tenderness',
    prompt: 'Any new neck pain or tenderness?',
    citation: 'crt6-2023',
  },
  {
    id: 'seizure',
    label: 'Seizure or convulsion',
    prompt: 'Has there been a seizure, fit, or convulsion?',
    citation: 'crt6-2023',
  },
  {
    id: 'vision-loss-or-double',
    label: 'Loss of vision or double vision',
    prompt: 'Any loss of vision, or seeing double?',
    citation: 'crt6-2023',
  },
  {
    id: 'loss-of-consciousness',
    label: 'Loss of consciousness',
    prompt: 'Has there been any loss of consciousness?',
    citation: 'crt6-2023',
  },
  {
    id: 'deteriorating-consciousness',
    label: 'Increasing confusion, drowsiness, or becoming less responsive',
    prompt: 'More confused, drowsy, or harder to wake than earlier?',
    citation: 'crt6-2023',
  },
  {
    id: 'limb-weakness',
    label: 'Weakness, numbness, or tingling in more than one arm or leg',
    prompt: 'Any weakness, numbness, or tingling in more than one arm or leg?',
    citation: 'crt6-2023',
  },
  {
    id: 'repeated-vomiting',
    label: 'Repeated vomiting',
    prompt: 'Any repeated vomiting?',
    citation: 'crt6-2023',
  },
  {
    id: 'severe-headache',
    label: 'Severe or increasing headache',
    prompt: 'Is the headache severe, or getting worse rather than better?',
    citation: 'crt6-2023',
  },
  {
    id: 'agitation',
    label: 'Increasingly restless, agitated, or combative',
    prompt: 'Increasingly restless, agitated, or combative?',
    citation: 'crt6-2023',
  },
  {
    id: 'skull-deformity',
    label: 'Visible deformity of the skull',
    prompt: 'Any visible deformity of the skull?',
    citation: 'crt6-2023',
  },
];

export const RED_FLAG_IDS = RED_FLAGS.map((flag) => flag.id);

export type RedFlagId = (typeof RED_FLAGS)[number]['id'];

/**
 * Shown verbatim when any red flag is reported. Deliberately short: someone
 * reading this screen is not in a state to parse nuance.
 */
export const RED_FLAG_INSTRUCTION =
  'Stop and get urgent medical care now. Do not wait to see if it improves, and do not drive ' +
  'yourself. If symptoms are severe or worsening quickly, call emergency services.';
