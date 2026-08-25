/**
 * Composing an accommodation packet.
 *
 * Selection, not generation. Every sentence a recipient reads comes from the
 * curated library in src/data/accommodations, filtered by the patient's stage
 * and today's tolerance bands, with the numbers filled in from the plan. No
 * language model writes a clinical instruction here, and the validator in
 * ./validate.ts exists to keep it that way if one is ever added for tone.
 *
 * Packets are versioned by content signature rather than by time. A school
 * office will not accept a fresh document every morning, so a packet is only
 * reissued when something in it actually changed — and when it is, the diff is
 * shown so the recipient can see what moved rather than re-reading four pages.
 */

import {
  ACCOMMODATIONS_BY_ROLE,
  type Accommodation,
  type AccommodationRole,
} from '@/data/accommodations';
import {
  CITATIONS,
  RED_FLAGS,
  RED_FLAG_INSTRUCTION,
  type CitationId,
  type LoadDomain,
  type RedFlag,
} from '@/data/guidelines';
import type { Session } from '@/engine/session';
import type { DayPlan } from '@/engine/tolerance/threshold';
import { attendanceHours, deriveSlots, fillSlots, type SlotValues } from './slots';

export interface PacketItem {
  readonly id: string;
  readonly domain: LoadDomain;
  readonly text: string;
  readonly rationale: string;
  readonly citation: CitationId;
}

export interface Packet {
  readonly role: AccommodationRole;
  readonly title: string;
  readonly patientName: string;
  readonly intro: string;
  readonly items: readonly PacketItem[];
  readonly sources: readonly { id: CitationId; label: string }[];
  readonly generatedOn: string;
  /** Stable over content, so an unchanged day does not reissue the document. */
  readonly signature: string;
  readonly slots: SlotValues;
  /**
   * The emergency list, attached to the caregiver packet only.
   *
   * A caregiver is the person most likely to be in the room when one of these
   * appears, and least likely to have been told what they are. Every other
   * item in a packet is an adjustment; this is the one that says stop.
   */
  readonly redFlags: {
    readonly instruction: string;
    readonly items: readonly RedFlag[];
  } | null;
}

const TITLES: Record<AccommodationRole, string> = {
  school: 'School accommodations',
  employer: 'Workplace accommodations',
  caregiver: 'Supporting someone through concussion recovery',
};

const INTROS: Record<AccommodationRole, (name: string) => string> = {
  school: (name) =>
    `These are the adjustments ${name} needs at school right now. They come from published ` +
    'concussion guidelines and from what the last few days have actually looked like, and they ' +
    'will change as recovery progresses. Medical clearance is not required to return to school.',
  employer: (name) =>
    `These are the adjustments ${name} needs at work right now. They are based on published ` +
    'concussion guidance and on how the last few days have gone. They are temporary, and they ' +
    'will reduce as recovery progresses.',
  caregiver: (name) =>
    `How to help ${name} without pushing too hard or holding them back. Both of those slow ` +
    'recovery, and the second one is the mistake families are rarely warned about.',
};

/**
 * Which ladder governs an item.
 *
 * The library is keyed to Return-to-Learn steps because that is what governs
 * cognitive, visual and social load. Physical items are the exception: they
 * follow the sport ladder when the patient is on one, because that is where
 * head-impact risk is staged.
 */
function stepFor(session: Session, item: Accommodation): number {
  if (item.domain === 'physical' && session.patient.protocol === 'return-to-sport') {
    return session.stage.step;
  }
  return session.learnStage.step;
}

function bandFor(plan: DayPlan, domain: LoadDomain) {
  return plan.recommendations.find((entry) => entry.domain === domain)?.band ?? 'very-low';
}

export function selectAccommodations(session: Session, role: AccommodationRole): Accommodation[] {
  const plan = session.plan;
  if (!plan) return [];

  const attendance = attendanceHours(plan);

  return ACCOMMODATIONS_BY_ROLE[role]
    .filter((item) => {
      const step = stepFor(session, item);
      if (step < item.minStep || step > item.maxStep) return false;
      // An item that presupposes a longer day than the plan supports would
      // contradict the very first line of the letter.
      if (item.minAttendanceHours !== undefined && attendance < item.minAttendanceHours) {
        return false;
      }
      return item.bands.includes(bandFor(plan, item.domain));
    })
    .sort((a, b) => a.priority - b.priority);
}

export function composePacket(session: Session, role: AccommodationRole): Packet | null {
  const plan = session.plan;
  if (!plan) return null;

  const slots = deriveSlots(plan);
  const selected = selectAccommodations(session, role);

  const items: PacketItem[] = selected.map((item) => ({
    id: item.id,
    domain: item.domain,
    text: fillSlots(item.text, slots),
    rationale: item.rationale,
    citation: item.citation,
  }));

  const usedCitations = [...new Set(items.map((item) => item.citation))];

  return {
    role,
    title: TITLES[role],
    patientName: session.patient.displayName,
    intro: INTROS[role](session.patient.displayName),
    items,
    sources: usedCitations.map((id) => ({ id, label: CITATIONS[id].shortLabel })),
    generatedOn: session.today,
    signature: signatureOf(items),
    slots,
    redFlags:
      role === 'caregiver' ? { instruction: RED_FLAG_INSTRUCTION, items: RED_FLAGS } : null,
  };
}

/**
 * Content signature. Deliberately excludes the date: two identical packets
 * issued a week apart are the same packet, and reissuing one because the
 * calendar moved is how a document stops being read.
 */
export function signatureOf(items: readonly PacketItem[]): string {
  return items.map((item) => `${item.id}:${item.text}`).join('|');
}

export interface PacketDiff {
  readonly added: readonly PacketItem[];
  readonly removed: readonly PacketItem[];
  readonly changed: readonly { readonly before: PacketItem; readonly after: PacketItem }[];
  readonly hasChanges: boolean;
}

export function diffPackets(previous: Packet | null, current: Packet): PacketDiff {
  if (!previous) {
    return { added: current.items, removed: [], changed: [], hasChanges: current.items.length > 0 };
  }

  const before = new Map(previous.items.map((item) => [item.id, item]));
  const after = new Map(current.items.map((item) => [item.id, item]));

  const added = current.items.filter((item) => !before.has(item.id));
  const removed = previous.items.filter((item) => !after.has(item.id));
  const changed = current.items
    .filter((item) => before.has(item.id) && before.get(item.id)!.text !== item.text)
    .map((item) => ({ before: before.get(item.id)!, after: item }));

  return {
    added,
    removed,
    changed,
    hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
  };
}
