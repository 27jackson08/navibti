/**
 * Demo persistence.
 *
 * An in-memory store, seeded from the same synthetic generator the evaluation
 * harness uses, so the demo personas behave like the cohort we measured rather
 * than like hand-picked happy paths.
 *
 * The Drizzle schema in ./schema.ts is the real target and the shapes here match
 * it. Swapping this for Postgres means replacing the four functions at the
 * bottom of this file; nothing above the storage boundary knows the difference,
 * because session state is replayed from the check-in log rather than stored.
 */

import { makePatient } from '@/data/synthetic/patient';
import { simulatePatient } from '@/data/synthetic/simulate';
import { isoDay, type CheckIn, type Patient } from '@/engine/session';

interface Store {
  readonly patients: Map<string, Patient>;
  readonly checkIns: Map<string, CheckIn[]>;
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
    id: 'amara',
    displayName: 'Amara',
    isMinor: true,
    protocol: 'return-to-learn',
    roles: ['school', 'caregiver'],
    seed: 41,
    historyDays: 3,
  },
];

function seedHistory(seed: number, days: number, injuryDate: string): CheckIn[] {
  const synthetic = { ...makePatient(seed), redFlagDay: null };
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
    checkIns.set(persona.id, seedHistory(persona.seed, persona.historyDays, injuryDate));
  }

  return { patients, checkIns };
}

/**
 * Cached on globalThis so the seeded demo survives Next's dev-mode module
 * reloading. Without this, every hot reload would silently reset the personas
 * mid-demo.
 */
const globalStore = globalThis as typeof globalThis & { __navitbiStore?: Store };
const store: Store = (globalStore.__navitbiStore ??= createStore());

export function listPatients(): Patient[] {
  return [...store.patients.values()];
}

export function getPatient(id: string): Patient | null {
  return store.patients.get(id) ?? null;
}

export function getCheckIns(patientId: string): CheckIn[] {
  return [...(store.checkIns.get(patientId) ?? [])];
}

/** Upserts by day, so re-doing today's check-in corrects it rather than duplicating. */
export function saveCheckIn(patientId: string, checkIn: CheckIn): void {
  const existing = store.checkIns.get(patientId) ?? [];
  const without = existing.filter((entry) => entry.day !== checkIn.day);
  store.checkIns.set(patientId, [...without, checkIn].sort((a, b) => a.day.localeCompare(b.day)));
}
