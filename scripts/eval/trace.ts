/**
 * Single-patient trace, for understanding why the engine did what it did.
 *
 * Run with: npm run trace -- [seed] [days]
 */

import { expectedDelta, makePatient, simulateDay } from '@/data/synthetic/patient';
import { seededRng } from '@/data/synthetic/random';
import { exceedanceProbability, observe, predict, priorPosterior } from '@/engine/tolerance/posterior';
import { planDay } from '@/engine/tolerance/threshold';
import type { LoadDomain } from '@/data/guidelines';

const seed = Number(process.argv[2] ?? 3);
const dayCount = Number(process.argv[3] ?? 14);

const patient = makePatient(seed);
const rng = seededRng(seed * 7919 + 13);

console.log(
  `patient ${seed}  tau=${patient.recoveryTau.toFixed(1)}  ` +
    `residual=${patient.residualSensitivity.toFixed(2)}  adherence=${patient.adherence.toFixed(2)}`,
);
console.log(
  'weights',
  Object.fromEntries(
    Object.entries(patient.baselineWeights).map(([key, value]) => [key, Number(value.toFixed(2))]),
  ),
);
console.log('\nday | noiseVar   df | predMean predScale | P(>2)@rest | trueDelta | cogDose bind');

let posterior = priorPosterior();
let context: Partial<Record<LoadDomain, number>> = {
  cognitive: 30,
  visualVestibular: 20,
  physical: 10,
  sleepFatigue: 1,
  emotionalAutonomic: 30,
};

for (let day = 0; day < dayCount; day += 1) {
  const step = Math.min(4, 1 + Math.floor(day / 2));
  const plan = planDay({ posterior, protocol: "return-to-learn", step, context, yesterday: context });
  const doses = plan.doses;

  const atPlan = predict(posterior, doses);
  const atRest = predict(posterior, { sleepFatigue: context.sleepFatigue ?? 0 });
  const cognitive = plan.recommendations.find((item) => item.domain === 'cognitive');

  console.log(
    `${String(day).padStart(3)} | ${(posterior.rate / posterior.shape).toFixed(2).padStart(8)} ` +
      `${(2 * posterior.shape).toFixed(1).padStart(4)} | ${atPlan.mean.toFixed(2).padStart(8)} ` +
      `${atPlan.scale.toFixed(2).padStart(9)} | ${exceedanceProbability(atRest, 2).toFixed(3).padStart(10)} | ` +
      `${expectedDelta(patient, day, doses).toFixed(2).padStart(9)} | ` +
      `${(cognitive?.dose ?? 0).toFixed(0).padStart(7)} ${cognitive?.binding ?? ''}`,
  );

  const observed = simulateDay(patient, day, doses, rng);
  posterior = observe(posterior, { doses, deltaPoints: observed.deltaPoints });
  context = doses;
}
