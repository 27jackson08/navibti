import { describe, expect, it } from 'vitest';
import {
  cholesky,
  dot,
  identity,
  invertSpd,
  matVec,
  outer,
  quadraticForm,
  solveSpd,
} from './matrix';
import { logGamma, studentTCdf, studentTQuantile, studentTSurvival } from './student-t';

describe('matrix basics', () => {
  it('builds a scaled identity', () => {
    expect(identity(2, 3)).toEqual([
      [3, 0],
      [0, 3],
    ]);
  });

  it('multiplies a matrix by a vector', () => {
    expect(matVec([[1, 2], [3, 4]], [1, 1])).toEqual([3, 7]);
  });

  it('accumulates an outer product', () => {
    expect(outer([1, 2], 2)).toEqual([
      [2, 4],
      [4, 8],
    ]);
  });
});

describe('cholesky', () => {
  it('factors a known matrix', () => {
    const l = cholesky([
      [4, 2],
      [2, 5],
    ]);
    expect(l[0][0]).toBeCloseTo(2, 12);
    expect(l[1][0]).toBeCloseTo(1, 12);
    expect(l[1][1]).toBeCloseTo(2, 12);
  });

  it('refuses a matrix that is not positive definite instead of returning NaN', () => {
    expect(() =>
      cholesky([
        [1, 2],
        [2, 1],
      ]),
    ).toThrow(/positive definite/);
  });
});

describe('solving', () => {
  it('solves A x = b', () => {
    const a = [
      [4, 2],
      [2, 5],
    ];
    const x = solveSpd(a, [10, 13]);
    expect(matVec(a, x)[0]).toBeCloseTo(10, 10);
    expect(matVec(a, x)[1]).toBeCloseTo(13, 10);
  });

  it('inverts so that A A⁻¹ is the identity', () => {
    const a = [
      [4, 2, 1],
      [2, 5, 2],
      [1, 2, 3],
    ];
    const inverse = invertSpd(a);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const entry = dot(a[i], invertSpd(a).map((row) => row[j]));
        expect(entry).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
    expect(inverse).toHaveLength(3);
  });

  it('computes xᵀA⁻¹x consistently with an explicit inverse', () => {
    const a = [
      [4, 1],
      [1, 3],
    ];
    const x = [2, -1];
    const inverse = invertSpd(a);
    const viaInverse = dot(x, matVec(inverse, x));
    expect(quadraticForm(a, x)).toBeCloseTo(viaInverse, 10);
  });

  it('grows the quadratic form as precision shrinks, which is what widens intervals', () => {
    const confident = quadraticForm(identity(2, 100), [1, 1]);
    const uncertain = quadraticForm(identity(2, 1), [1, 1]);
    expect(uncertain).toBeGreaterThan(confident);
  });
});

describe('logGamma', () => {
  it.each([
    [1, 0],
    [2, 0],
    [3, Math.log(2)],
    [5, Math.log(24)],
  ])('logGamma(%i) matches the factorial', (z, expected) => {
    expect(logGamma(z)).toBeCloseTo(expected, 10);
  });

  it('handles the reflection branch below 0.5', () => {
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });
});

describe('student t', () => {
  it('is symmetric about zero', () => {
    for (const df of [1, 5, 30]) {
      expect(studentTCdf(0, df)).toBeCloseTo(0.5, 10);
      expect(studentTCdf(-1.5, df)).toBeCloseTo(1 - studentTCdf(1.5, df), 10);
    }
  });

  // Values from standard t-tables.
  it.each([
    [0.975, 1, 12.706],
    [0.975, 10, 2.228],
    [0.95, 10, 1.812],
    [0.975, 30, 2.042],
    [0.8, 5, 0.9195],
    [0.9, 20, 1.325],
  ])('quantile(%f, df=%i) is %f', (p, df, expected) => {
    expect(studentTQuantile(p, df)).toBeCloseTo(expected, 3);
  });

  it('approaches the normal quantile as degrees of freedom grow', () => {
    expect(studentTQuantile(0.975, 100000)).toBeCloseTo(1.96, 2);
  });

  it('round-trips against the cdf', () => {
    for (const df of [2, 7, 40]) {
      for (const p of [0.1, 0.5, 0.8, 0.99]) {
        expect(studentTCdf(studentTQuantile(p, df), df)).toBeCloseTo(p, 8);
      }
    }
  });

  it('has fatter tails at low degrees of freedom, which is the conservatism', () => {
    // The same standardised distance is a much likelier breach when the model
    // has seen almost nothing.
    expect(studentTSurvival(2, 2)).toBeGreaterThan(studentTSurvival(2, 200));
  });

  it('rejects impossible probabilities rather than returning a bound', () => {
    expect(() => studentTQuantile(0, 5)).toThrow(/in \(0, 1\)/);
    expect(() => studentTQuantile(1, 5)).toThrow(/in \(0, 1\)/);
  });
});
