/**
 * Small dense linear algebra for the tolerance model.
 *
 * Matrices here are at most 6x6 (five load domains plus an intercept), so
 * clarity beats cleverness and there is no reason to pull in a dependency.
 * Everything is immutable: operations return new arrays.
 */

export type Vector = readonly number[];
export type Matrix = readonly (readonly number[])[];

export function identity(n: number, scale = 1): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? scale : 0)),
  );
}

export function addMatrices(a: Matrix, b: Matrix): number[][] {
  return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

export function matVec(a: Matrix, x: Vector): number[] {
  return a.map((row) => row.reduce((sum, value, j) => sum + value * x[j], 0));
}

export function dot(a: Vector, b: Vector): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

/** Outer product scaled by `weight`, used to accumulate XᵀX one row at a time. */
export function outer(x: Vector, weight = 1): number[][] {
  return x.map((xi) => x.map((xj) => weight * xi * xj));
}

/**
 * Lower-triangular Cholesky factor of a symmetric positive-definite matrix.
 *
 * Throws rather than returning NaN if the matrix is not positive definite —
 * that would mean the precision matrix had gone singular, which is a bug in
 * the update rather than a condition to paper over.
 */
export function cholesky(a: Matrix): number[][] {
  const n = a.length;
  const l = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = a[i][j];
      for (let k = 0; k < j; k += 1) sum -= l[i][k] * l[j][k];

      if (i === j) {
        if (sum <= 0) {
          throw new Error(
            `matrix is not positive definite (pivot ${sum.toExponential(3)} at index ${i})`,
          );
        }
        l[i][j] = Math.sqrt(sum);
      } else {
        l[i][j] = sum / l[j][j];
      }
    }
  }
  return l;
}

/** Solves `A x = b` given the Cholesky factor of A. */
export function choleskySolve(l: Matrix, b: Vector): number[] {
  const n = l.length;
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = b[i];
    for (let k = 0; k < i; k += 1) sum -= l[i][k] * y[k];
    y[i] = sum / l[i][i];
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = y[i];
    for (let k = i + 1; k < n; k += 1) sum -= l[k][i] * x[k];
    x[i] = sum / l[i][i];
  }
  return x;
}

export function solveSpd(a: Matrix, b: Vector): number[] {
  return choleskySolve(cholesky(a), b);
}

export function invertSpd(a: Matrix): number[][] {
  const l = cholesky(a);
  const n = a.length;
  const columns = Array.from({ length: n }, (_, j) =>
    choleskySolve(
      l,
      Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)),
    ),
  );
  return Array.from({ length: n }, (_, i) => columns.map((column) => column[i]));
}

/**
 * xᵀ A⁻¹ x, computed by solving rather than by forming the inverse.
 *
 * This is the term that makes the predictive interval widen where the model has
 * seen little data, which is what makes sparse data produce small recommended
 * doses without any special-case branch.
 */
export function quadraticForm(a: Matrix, x: Vector): number {
  return dot(x, solveSpd(a, x));
}
