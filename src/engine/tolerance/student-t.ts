/**
 * Student-t distribution functions.
 *
 * The posterior predictive of a Normal-Inverse-Gamma model is Student-t, and
 * the fat tails at low degrees of freedom are the point rather than a nuisance:
 * with three days of data the predictive interval is genuinely wide, so the
 * dose that keeps the exceedance probability under the target is genuinely
 * small. A normal approximation would quietly discard that conservatism.
 */

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const shifted = z - 1;
  let series = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i += 1) series += LANCZOS[i] / (shifted + i + 1);
  const t = shifted + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

/** Continued-fraction expansion for the incomplete beta function. */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAX_ITERATIONS = 300;
  const EPSILON = 3e-16;
  const TINY = 1e-300;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITERATIONS; m += 1) {
    const m2 = 2 * m;

    let numerator = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;

    numerator = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;

    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return h;
}

/** Regularized incomplete beta function, I_x(a, b). */
export function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );

  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function studentTCdf(t: number, degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) throw new Error('degrees of freedom must be positive');
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  const tail = 0.5 * regularizedIncompleteBeta(degreesOfFreedom / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}

/** P(T > t). The quantity we actually care about: the chance of breaching the limit. */
export function studentTSurvival(t: number, degreesOfFreedom: number): number {
  return 1 - studentTCdf(t, degreesOfFreedom);
}

/**
 * Inverse CDF by bisection.
 *
 * Bisection rather than a rational approximation because it is obviously
 * correct, and at 6x6 problem sizes the cost is irrelevant.
 */
export function studentTQuantile(p: number, degreesOfFreedom: number): number {
  if (p <= 0 || p >= 1) throw new Error(`quantile probability must be in (0, 1), got ${p}`);

  let low = -1e4;
  let high = 1e4;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (studentTCdf(mid, degreesOfFreedom) < p) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
