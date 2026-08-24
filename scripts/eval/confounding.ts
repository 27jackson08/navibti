/**
 * Calibrates the confounding threshold used by the attribution engine.
 *
 * Run with: npm run calibrate:confounding
 */
import { gaussian, seededRng } from '@/data/synthetic/random';
import { priorPosterior, updateAll } from '@/engine/tolerance/posterior';
import { weightCorrelation } from '@/engine/attribution/attribution';

function build(days: number, sharing: number, seed: number) {
  const rng = seededRng(seed);
  return updateAll(
    priorPosterior(),
    Array.from({ length: days }, () => {
      const shared = rng() * 240;
      const independent = rng() * 240;
      const visual = sharing * shared + (1 - sharing) * independent;
      return {
        doses: { cognitive: shared, visualVestibular: visual, physical: rng() * 60, sleepFatigue: rng() * 3 },
        deltaPoints: 0.3 + 1.4 * (shared / 240) + 1.2 * (visual / 240) + gaussian(rng) * 0.2,
      };
    }),
  );
}

console.log('sharing | days=10  days=20  days=40  days=80');
for (const sharing of [0, 0.25, 0.5, 0.75, 0.9, 1]) {
  const row = [10, 20, 40, 80].map((days) =>
    Math.abs(weightCorrelation(build(days, sharing, 11), 'cognitive', 'visualVestibular'))
      .toFixed(3)
      .padStart(7),
  );
  console.log(`${sharing.toFixed(2).padStart(7)} | ${row.join(' ')}`);
}
