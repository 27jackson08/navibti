/**
 * Demo persistence.
 *
 * An in-memory store, seeded from the same synthetic generator the evaluation
 * harness uses, so the demo personas behave like the cohort we measured rather
 * than like hand-picked happy paths.
 *
 * The Drizzle schema in ./schema.ts is the real target, and `schema.test.ts`
 * keeps the two in step — that claim used to be a comment, and the comment went
 * stale: the schema had no home for a patient's protocol, roles, clinician
 * ceilings or clearance, and no table at all for the recipient responses that
 * make this a coordinator rather than a generator. Nothing failed, because
 * nothing runs the schema.
 *
 * Swapping this for Postgres means replacing the accessors at the bottom of
 * this file and the equivalents in ./share.ts and ./responses.ts. Nothing above
 * the storage boundary knows the difference, because session state is replayed
 * from the check-in log rather than stored.
 */

import { makePatient } from '@/data/synthetic/patient';
import { simulatePatient } from '@/data/synthetic/simulate';
import { isoDay, type CheckIn, type Patient } from '@/engine/session';
import type { LoadDomain } from '@/data/guidelines';

interface Store {
  readonly patients: Map<string, Patient>;
  readonly checkIns: Map<string, CheckIn[]>;
  /**
   * The date this store seeded itself against.
   *
   * Exposed because the seeded histories are positioned relative to it, and a
   * caller that computes its own "today" from the clock can disagree with it —
   * the two are read at different moments, and once a day they land on opposite
   * sides of UTC midnight. Tests use this instead of reading the clock again.
   */
  readonly seededOn: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Seeded personas. Each maps to a synthetic patient so the history is real. */
const PERSONAS: readonly {
  id: string;
  displayName: string;
  isMinor: boolean;
  protocol: Patient['protocol'];
  roles: Patient['roles'];
  seed: number;
  historyDays: number;
  fullReturnToSchool?: boolean;
  /**
   * Overrides the generated adherence. Above 1 means this patient consistently
   * does more than the plan asks.
   */
  adherence?: number;
}[] = [
  {
    id: 'maya',
    displayName: 'Maya',
    isMinor: true,
    protocol: 'return-to-sport',
    roles: ['school', 'caregiver'],
    seed: 3,
    historyDays: 6,
  },
  {
    id: 'daniel',
    displayName: 'Daniel',
    isMinor: false,
    protocol: 'return-to-learn',
    roles: ['employer'],
    seed: 17,
    historyDays: 11,
  },
  {
    // Well into recovery, and the only persona whose plan the model is actually
    // driving. That is not a property of this patient — Maya and Daniel look the
    // same way at eighteen days. It is a property of the model, which needs
    // roughly two weeks of check-ins before it has more to say than the
    // guideline floor does. A demo without someone at this stage shows only the
    // floor, and the environment feedback has nothing to act on.
    id: 'tom',
    displayName: 'Tom',
    isMinor: false,
    protocol: 'return-to-learn',
    roles: ['employer'],
    seed: 11,
    historyDays: 15,
  },
  {
    id: 'amara',
    displayName: 'Amara',
    isMinor: true,
    protocol: 'return-to-learn',
    roles: ['school', 'caregiver'],
    seed: 41,
    historyDays: 3,
  },
];

function seedHistory(
  seed: number,
  days: number,
  injuryDate: string,
  adherence?: number,
): CheckIn[] {
  const synthetic = {
    ...makePatient(seed),
    redFlagDay: null,
    ...(adherence === undefined ? {} : { adherence }),
  };
  const { days: simulated } = simulatePatient(synthetic, days);

  return simulated.map((day) => {
    // A plausible morning baseline that eases as recovery progresses.
    const preActivitySeverity = Number(Math.max(0, 3 - day.day * 0.15).toFixed(1));
    return {
      day: isoDay(new Date(Date.parse(`${injuryDate}T00:00:00Z`) + day.day * DAY_MS)),
      preActivitySeverity,
      worstSeverity: Number(
        Math.min(10, preActivitySeverity + day.observed.deltaPoints).toFixed(1),
      ),
      deltaDurationMinutes: day.observed.durationMinutes,
      doses: Object.fromEntries(
        Object.entries(day.actual).map(([domain, dose]) => [domain, Math.round(dose * 10) / 10]),
      ),
      redFlagIds: [],
    };
  });
}

function createStore(): Store {
  const patients = new Map<string, Patient>();
  const checkIns = new Map<string, CheckIn[]>();
  const now = Date.now();
  const seededOn = isoDay(new Date(now));

  for (const persona of PERSONAS) {
    const injuryDate = isoDay(new Date(now - persona.historyDays * DAY_MS));
    patients.set(persona.id, {
      id: persona.id,
      displayName: persona.displayName,
      isMinor: persona.isMinor,
      injuryDate,
      protocol: persona.protocol,
      roles: persona.roles,
      fullReturnToSchool: persona.fullReturnToSchool,
    });
    checkIns.set(
      persona.id,
      seedHistory(persona.seed, persona.historyDays, injuryDate, persona.adherence),
    );
  }

  return { patients, checkIns, seededOn };
}

/**
 * Cached on globalThis so the seeded demo survives Next's dev-mode module
 * reloading. Without this, every hot reload would silently reset the personas
 * mid-demo.
 */
const globalStore = globalThis as typeof globalThis & { __navitbiStore?: Store };
const store: Store = (globalStore.__navitbiStore ??= createStore());

/** The date the seeded demo histories were positioned against. */
export const seededOn = store.seededOn;

export function listPatients(): Patient[] {
  return [...store.patients.values()];
}

export function getPatient(id: string): Patient | null {
  return store.patients.get(id) ?? null;
}

export function getCheckIns(patientId: string): CheckIn[] {
  return [...(store.checkIns.get(patientId) ?? [])];
}

/**
 * Records what a clinician has decided.
 *
 * Deliberately the only way clearance enters the system, and deliberately not
 * something the patient can do to their own record. NaviTBI issues nothing; it
 * stores what a clinician says they decided, attributed to them by name and
 * stamped, and the stage machine's refusal to self-clear is unchanged.
 */
export function recordClinicianDecision(
  patientId: string,
  decision: {
    readonly clearance?: { readonly recordedBy: string; readonly coversUpToStep: number };
    readonly clinicianCaps?: Partial<Record<LoadDomain, number>>;
  },
): boolean {
  const patient = store.patients.get(patientId);
  if (!patient) return false;

  store.patients.set(patientId, {
    ...patient,
    clearance: decision.clearance
      ? {
          recordedBy: decision.clearance.recordedBy,
          recordedAt: new Date(),
          coversUpToStep: decision.clearance.coversUpToStep,
        }
      : patient.clearance,
    clinicianCaps: decision.clinicianCaps ?? patient.clinicianCaps,
  });
  return true;
}

/**
 * Upserts by day, so redoing today's check-in corrects it rather than
 * duplicating — with one exception.
 *
 * A red flag already recorded for that day is carried forward and never
 * silently dropped. Without that, the guarantee that no plan is generated on a
 * red-flag day is defeatable by simply redoing the check-in: the flag
 * disappears, the plan comes back, and the clinician record loses the fact that
 * an emergency symptom was reported at all.
 *
 * There is no mis-tap to protect here. The check-in offers "I selected that by
 * mistake" *before* anything is stored, so a flag that reached this function was
 * deliberate. Clearing one afterwards should be an explicit, recorded action,
 * and deliberately is not one yet.
 */
export function saveCheckIn(patientId: string, checkIn: CheckIn): void {
  const existing = store.checkIns.get(patientId) ?? [];
  const previous = existing.find((entry) => entry.day === checkIn.day);

  const merged: CheckIn = {
    ...checkIn,
    redFlagIds: [...new Set([...(previous?.redFlagIds ?? []), ...checkIn.redFlagIds])],
  };

  const without = existing.filter((entry) => entry.day !== checkIn.day);
  store.checkIns.set(patientId, [...without, merged].sort((a, b) => a.day.localeCompare(b.day)));
}
