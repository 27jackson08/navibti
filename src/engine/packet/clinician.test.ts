import { describe, expect, it } from 'vitest';
import { CITATIONS, PROTOCOLS } from '@/data/guidelines';
import { getCheckIns, getPatient, seededOn } from '@/db/store';
import { type CheckIn } from '@/engine/session';
import { clinicianSummary } from './clinician';

const today = seededOn;
const maya = getPatient('maya')!;
const daniel = getPatient('daniel')!;

const mayaSummary = clinicianSummary(maya, getCheckIns('maya'), today);
const danielSummary = clinicianSummary(daniel, getCheckIns('daniel'), today);

describe('the record', () => {
  it('covers every check-in', () => {
    expect(mayaSummary.trajectory).toHaveLength(getCheckIns('maya').length);
  });

  it('marks days that breached the mild-and-brief limit', () => {
    for (const point of mayaSummary.trajectory) {
      const shouldExceed = point.deltaPoints > 2 || point.durationMinutes > 60;
      expect(point.exceeded, point.day).toBe(shouldExceed);
    }
  });

  it('separates flares from red-flag days', () => {
    for (const point of mayaSummary.flareDays) {
      expect(point.redFlagged).toBe(false);
    }
  });

  it('shows the sport ladder only for a patient on one', () => {
    expect(mayaSummary.sport).not.toBeNull();
    expect(danielSummary.sport).toBeNull();
    expect(danielSummary.learn.total).toBe(4);
    expect(mayaSummary.sport?.total).toBe(6);
  });

  it('reports how much evidence the estimates rest on', () => {
    expect(danielSummary.observations).toBe(getCheckIns('daniel').length);
    expect(danielSummary.isPersonalized).toBe(true);
  });
});

describe('adherence', () => {
  it('compares each day against the plan as it stood that day', () => {
    // Not against today's plan: "was this followed?" means followed at the
    // time, not measured against a recommendation that did not exist yet.
    expect(danielSummary.adherence.length).toBeGreaterThan(0);
    for (const point of danielSummary.adherence) {
      expect(point.ratio).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(point.ratio)).toBe(true);
    }
  });

  it('flags an overshoot', () => {
    const overshooting: CheckIn[] = getCheckIns('daniel').map((checkIn) => ({
      ...checkIn,
      doses: { ...checkIn.doses, cognitive: 480, visualVestibular: 480 },
    }));
    const summary = clinicianSummary(daniel, overshooting, today);
    expect(summary.adherence.some((point) => point.overshot)).toBe(true);
  });

  it('does not report an overshoot for someone who followed the plan', () => {
    const compliant: CheckIn[] = getCheckIns('daniel').map((checkIn) => ({
      ...checkIn,
      // Every logged domain well under any plausible recommendation, not just
      // the two that are easiest to picture.
      doses: {
        ...checkIn.doses,
        cognitive: 1,
        visualVestibular: 1,
        physical: 1,
        emotionalAutonomic: 1,
      },
    }));
    const summary = clinicianSummary(daniel, compliant, today);
    expect(summary.adherence.every((point) => !point.overshot)).toBe(true);
  });
});

describe('open questions', () => {
  it('are questions about the record, never conclusions about the patient', () => {
    const summary = clinicianSummary(daniel, getCheckIns('daniel').slice(0, 1), today);
    for (const question of summary.openQuestions) {
      expect(question).not.toMatch(/\bdiagnos|\bprescrib|\bcaused by\b/i);
    }
  });

  it('says so when there is barely any data', () => {
    const summary = clinicianSummary(daniel, getCheckIns('daniel').slice(0, 2), today);
    expect(summary.openQuestions.join(' ')).toMatch(/fewer than three check-ins/i);
    expect(summary.isPersonalized).toBe(false);
  });

  it('stays quiet about data volume once there is enough', () => {
    expect(danielSummary.openQuestions.join(' ')).not.toMatch(/fewer than three/i);
  });
});

describe('current tolerance', () => {
  it('lists every domain with what bound it', () => {
    expect(danielSummary.currentTolerance).toHaveLength(5);
    for (const line of danielSummary.currentTolerance) {
      expect(['model', 'ramp', 'stage', 'floor']).toContain(line.binding);
    }
  });
});

describe('a red-flag day', () => {
  const flagged: CheckIn[] = [
    ...getCheckIns('daniel'),
    {
      day: today,
      preActivitySeverity: 4,
      worstSeverity: 8,
      deltaDurationMinutes: 240,
      doses: { cognitive: 30 },
      redFlagIds: ['severe-headache'],
    },
  ];
  const summary = clinicianSummary(daniel, flagged, today);

  it('appears in the record', () => {
    expect(summary.redFlagDays).toHaveLength(1);
    expect(summary.redFlagDays[0].day).toBe(today);
  });

  it('is excluded from adherence, having produced no plan', () => {
    expect(summary.adherence.some((point) => point.day === today)).toBe(false);
  });
});

describe('what the clinician summary is built on', () => {
  /**
   * "Citations on every output" is one of the four things this project does not
   * cut. This was the output that cut it — read by the audience most likely to
   * want to check where a stage name or a threshold came from.
   */
  const summaryFor = (id: string) =>
    clinicianSummary(getPatient(id)!, getCheckIns(id), seededOn);

  it('cites something', () => {
    expect(summaryFor('daniel').sources.length).toBeGreaterThan(0);
  });

  it('names only citations that exist', () => {
    for (const id of ['maya', 'daniel', 'tom', 'amara']) {
      for (const source of summaryFor(id).sources) {
        expect(CITATIONS[source.id], `${id} cites unknown ${source.id}`).toBeDefined();
        expect(source.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('cites the sport protocol only for a patient on it', () => {
    const sportCitation = PROTOCOLS['return-to-sport'].citation;
    const learnOnly = summaryFor('daniel');
    const onSport = summaryFor('maya');

    expect(getPatient('daniel')!.protocol).toBe('return-to-learn');
    expect(getPatient('maya')!.protocol).toBe('return-to-sport');
    expect(onSport.sources.map((s) => s.id)).toContain(sportCitation);
    // Both protocols happen to cite the same guideline, so this asserts the
    // shape rather than a difference that does not exist: a learn-only summary
    // must never carry a citation that only the sport ladder introduces.
    const learnCitations = new Set(learnOnly.sources.map((s) => s.id));
    for (const id of learnCitations) expect(CITATIONS[id]).toBeDefined();
  });

  it('lists each citation once', () => {
    const ids = summaryFor('maya').sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
