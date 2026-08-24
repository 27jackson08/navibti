/**
 * Seeded pseudo-randomness.
 *
 * The evaluation harness has to be reproducible — a safety rate that changes
 * between runs is not a measurement — so nothing in the synthetic pipeline uses
 * Math.random.
 */

export type Rng = () => number;

/** mulberry32: small, fast, and good enough for generating study cohorts. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller. Returns one standard normal draw per call. */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}
