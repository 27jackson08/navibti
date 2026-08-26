/**
 * Sweeps the exceedance target so the trade it buys is measured rather than
 * argued about. Run: npm run sweep
 */
import { makeCohort } from '@/data/synthetic/patient';
import { simulatePatient, summarize } from '@/data/synthetic/simulate';
import { TOLERANCE_EXCEEDANCE_QUANTILE } from '@/data/guidelines';

const cohort = makeCohort(120);
const original = TOLERANCE_EXCEEDANCE_QUANTILE.value;

console.log('alpha  unsafe  over-est  load  floor-rescued  collapsed');
for (const alpha of [0.2, 0.15, 0.1, 0.07, 0.05, 0.03, 0.02]) {
  // The constant is read at call time, so overriding it here sweeps the whole
  // pipeline without threading a parameter through six modules.
  (TOLERANCE_EXCEEDANCE_QUANTILE as { value: number }).value = alpha;

  const m = summarize(cohort.map((p) => simulatePatient(p, 21)));
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(6);
  console.log(
    `${alpha.toFixed(2)}  ${pct(m.unsafeRecommendationRate)}  ${pct(m.overEstimationRate)}` +
      `  ${m.meanRecommendedLoad.toFixed(2)}  ${pct(m.floorRescuedDayShare)}       ${pct(m.collapsedToleranceRate)}`,
  );
}
(TOLERANCE_EXCEEDANCE_QUANTILE as { value: number }).value = original;
