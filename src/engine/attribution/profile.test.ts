import { describe, expect, it } from 'vitest';
import { gaussian, seededRng } from '@/data/synthetic/random';
import { priorPosterior, updateAll, type Observation } from '@/engine/tolerance/posterior';
import { sensitivityProfile } from './attribution';

/**
 * The standing pattern, not a single bad day. This is the closest NaviTBI comes
 * to the clinical subtyping literature, and it has to stop well short of it:
 * subtyping is a clinical judgement made with an examination, and this is
 * self-reported minutes.
 */

function patientWhere(weights: Record<string, number>, days = 60, seed = 5) {
  const rng = seededRng(seed);
  return updateAll(
    priorPosterior(),
    Array.from({ length: days }, (): Observation => {
      const doses = {
        cognitive: rng() * 300,
        visualVestibular: rng() * 300,
        physical: rng() * 90,
        emotionalAutonomic: rng() * 300,
        sleepFatigue: rng() * 3,
      };
      const delta =
        0.2 +
        (weights.cognitive ?? 0) * (doses.cognitive / 240) +
        (weights.visualVestibular ?? 0) * (doses.visualVestibular / 240) +
        (weights.physical ?? 0) * (doses.physical / 60) +
        (weights.emotionalAutonomic ?? 0) * (doses.emotionalAutonomic / 240);
      return { doses, deltaPoints: delta + gaussian(rng) * 0.2 };
    }),
  );
}

describe('naming the standing pattern', () => {
  it('identifies the dominant sensitivity', () => {
    const profile = sensitivityProfile(
      patientWhere({ cognitive: 0.4, visualVestibular: 3.2, physical: 0.1, emotionalAutonomic: 0.3 }),
    );
    expect(profile.canDescribe).toBe(true);
    expect(profile.leading).toBe('visualVestibular');
  });

  it('describes what it resembles without assigning it', () => {
    const profile = sensitivityProfile(
      patientWhere({ cognitive: 0.4, visualVestibular: 3.2, physical: 0.1, emotionalAutonomic: 0.3 }),
    );
    expect(profile.resembles).toContain('vestibular');
    expect(profile.summary).toMatch(/often described as/i);
    expect(profile.summary).toMatch(/worth raising at your next appointment/i);
    // Never a diagnosis, and never an instruction to act on it here.
    expect(profile.summary).not.toMatch(/\byou have\b|\bdiagnos|\byour subtype\b/i);
  });

  it('refuses when two kinds of load cost about the same', () => {
    const profile = sensitivityProfile(
      patientWhere({ cognitive: 1.6, visualVestibular: 1.6, physical: 0.2, emotionalAutonomic: 0.3 }),
    );
    expect(profile.canDescribe).toBe(false);
    expect(profile.leading).toBeNull();
    expect(profile.summary).toMatch(/about the same/i);
  });

  it('says nothing before there is enough data', () => {
    const profile = sensitivityProfile(priorPosterior());
    expect(profile.canDescribe).toBe(false);
    expect(profile.summary).toMatch(/not enough check-ins yet/i);
  });

  it('never nominates sleep, which is a resource rather than a load', () => {
    const profile = sensitivityProfile(
      patientWhere({ cognitive: 0.3, visualVestibular: 0.3, physical: 0.2, emotionalAutonomic: 3.0 }),
    );
    expect(profile.leading).not.toBe('sleepFatigue');
  });

  it('reports the separation it measured, so the refusal is inspectable', () => {
    const clear = sensitivityProfile(
      patientWhere({ cognitive: 0.4, visualVestibular: 3.2, physical: 0.1, emotionalAutonomic: 0.3 }),
    );
    const muddy = sensitivityProfile(
      patientWhere({ cognitive: 1.6, visualVestibular: 1.6, physical: 0.2, emotionalAutonomic: 0.3 }),
    );
    expect(clear.separation).toBeGreaterThan(muddy.separation);
  });
});
