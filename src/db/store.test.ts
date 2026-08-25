import { beforeEach, describe, expect, it } from 'vitest';
import { getCheckIns, getPatient, listPatients, saveCheckIn } from './store';
import { buildSession, isoDay, type CheckIn } from '@/engine/session';
import { composePacket } from '@/engine/packet/compose';

const today = isoDay(new Date());
const PATIENT = 'daniel';

function ordinary(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    day: today,
    preActivitySeverity: 2,
    worstSeverity: 3,
    deltaDurationMinutes: 20,
    doses: { cognitive: 60, visualVestibular: 40, physical: 10, emotionalAutonomic: 30 },
    redFlagIds: [],
    ...overrides,
  };
}

describe('the demo store', () => {
  it('seeds three patients with histories', () => {
    expect(listPatients()).toHaveLength(3);
    for (const patient of listPatients()) {
      expect(getCheckIns(patient.id).length).toBeGreaterThan(0);
    }
  });

  it('upserts by day rather than duplicating', () => {
    const before = getCheckIns(PATIENT).length;
    saveCheckIn(PATIENT, ordinary());
    saveCheckIn(PATIENT, ordinary({ worstSeverity: 5 }));
    const after = getCheckIns(PATIENT);

    expect(after.filter((entry) => entry.day === today)).toHaveLength(1);
    expect(after.find((entry) => entry.day === today)?.worstSeverity).toBe(5);
    expect(after.length).toBeLessThanOrEqual(before + 1);
  });
});

describe('a red flag cannot be walked back by redoing the day', () => {
  beforeEach(() => {
    saveCheckIn(PATIENT, ordinary({ redFlagIds: ['severe-headache'] }));
  });

  it('keeps the flag when the day is re-submitted without one', () => {
    saveCheckIn(PATIENT, ordinary({ redFlagIds: [] }));
    expect(getCheckIns(PATIENT).find((entry) => entry.day === today)?.redFlagIds).toContain(
      'severe-headache',
    );
  });

  it('still refuses to generate a plan afterwards', () => {
    // The whole guarantee — no guidance on a day when someone reported an
    // emergency symptom — was previously defeatable by pressing "redo".
    saveCheckIn(PATIENT, ordinary({ redFlagIds: [] }));

    const session = buildSession(getPatient(PATIENT)!, getCheckIns(PATIENT), today);
    expect(session.redFlag).not.toBeNull();
    expect(session.plan).toBeNull();
    expect(composePacket(session, 'employer')).toBeNull();
  });

  it('accumulates flags rather than replacing them', () => {
    saveCheckIn(PATIENT, ordinary({ redFlagIds: ['repeated-vomiting'] }));
    const flags = getCheckIns(PATIENT).find((entry) => entry.day === today)?.redFlagIds ?? [];
    expect(flags).toContain('severe-headache');
    expect(flags).toContain('repeated-vomiting');
  });

  it('does not duplicate a flag reported twice', () => {
    saveCheckIn(PATIENT, ordinary({ redFlagIds: ['severe-headache'] }));
    const flags = getCheckIns(PATIENT).find((entry) => entry.day === today)?.redFlagIds ?? [];
    expect(flags.filter((id) => id === 'severe-headache')).toHaveLength(1);
  });

  it('leaves other days untouched', () => {
    const other = getCheckIns(PATIENT).filter((entry) => entry.day !== today);
    for (const entry of other) {
      expect(entry.redFlagIds).toEqual([]);
    }
  });
});
